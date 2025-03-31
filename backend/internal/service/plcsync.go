// internal/service/plcsync.go
package service

import (
	"app_padrao/internal/domain"
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"
)

var (
	ErrSyncAlreadyRunning = errors.New("serviço de sincronização já está em execução")
	ErrSyncNotRunning     = errors.New("serviço de sincronização não está em execução")
)

// PLCSyncService gerencia a sincronização entre PostgreSQL e Redis
type PLCSyncService struct {
	// Repositórios PostgreSQL (persistência)
	pgPLCRepo domain.PLCRepository
	pgTagRepo domain.PLCTagRepository

	// Repositórios Redis (cache de trabalho)
	redisPLCRepo domain.PLCRepository
	redisTagRepo domain.PLCTagRepository

	// Controle de sincronização
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	syncInterval  time.Duration
	initialImport bool
	isRunning     bool
	mu            sync.Mutex // Para sincronizar acesso às flags de estado

	// Rastreamento de modificações
	lastSyncTime  time.Time
	changeTracker *changeTracker
}

// changeTracker rastreia mudanças para sincronização incremental
type changeTracker struct {
	plcModifications map[int]time.Time
	tagModifications map[int]time.Time
	mu               sync.RWMutex
}

// newChangeTracker cria um novo rastreador de mudanças
func newChangeTracker() *changeTracker {
	return &changeTracker{
		plcModifications: make(map[int]time.Time),
		tagModifications: make(map[int]time.Time),
	}
}

// trackPLCChange registra uma modificação de PLC
func (ct *changeTracker) trackPLCChange(plcID int) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.plcModifications[plcID] = time.Now()
}

// trackTagChange registra uma modificação de tag
func (ct *changeTracker) trackTagChange(tagID int) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.tagModifications[tagID] = time.Now()
}

// getModifiedPLCs obtém IDs de PLCs modificados desde um timestamp
func (ct *changeTracker) getModifiedPLCs(since time.Time) []int {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	modified := make([]int, 0)
	for plcID, modTime := range ct.plcModifications {
		if modTime.After(since) {
			modified = append(modified, plcID)
		}
	}
	return modified
}

// getModifiedTags obtém IDs de tags modificadas desde um timestamp
func (ct *changeTracker) getModifiedTags(since time.Time) []int {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	modified := make([]int, 0)
	for tagID, modTime := range ct.tagModifications {
		if modTime.After(since) {
			modified = append(modified, tagID)
		}
	}
	return modified
}

// NewPLCSyncService cria um novo serviço de sincronização
func NewPLCSyncService(
	pgPLCRepo domain.PLCRepository,
	pgTagRepo domain.PLCTagRepository,
	redisPLCRepo domain.PLCRepository,
	redisTagRepo domain.PLCTagRepository,
	initialImport bool,
) *PLCSyncService {
	return &PLCSyncService{
		pgPLCRepo:     pgPLCRepo,
		pgTagRepo:     pgTagRepo,
		redisPLCRepo:  redisPLCRepo,
		redisTagRepo:  redisTagRepo,
		syncInterval:  5 * time.Minute,
		initialImport: initialImport,
		isRunning:     false,
		lastSyncTime:  time.Now(),
		changeTracker: newChangeTracker(),
	}
}

// Start inicia o serviço de sincronização
func (s *PLCSyncService) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return ErrSyncAlreadyRunning
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.ctx = ctx
	s.cancel = cancel
	s.isRunning = true

	log.Println("Iniciando serviço de sincronização PostgreSQL -> Redis")

	// Fazer importação inicial se necessário
	if s.initialImport {
		if err := s.performFullSync(); err != nil {
			log.Printf("Erro na sincronização inicial: %v", err)
			s.cancel()
			s.isRunning = false
			return fmt.Errorf("erro na sincronização inicial: %w", err)
		}
	}

	// Iniciar rotina de sincronização periódica
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(s.syncInterval)
		defer ticker.Stop()

		for {
			select {
			case <-s.ctx.Done():
				log.Println("Serviço de sincronização encerrado")
				return
			case <-ticker.C:
				if err := s.performIncrementalSync(); err != nil {
					log.Printf("Erro na sincronização periódica: %v", err)
				}
			}
		}
	}()

	return nil
}

// SetSyncInterval configura o intervalo de sincronização
func (s *PLCSyncService) SetSyncInterval(interval time.Duration) {
	if interval < time.Second {
		interval = time.Second
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.syncInterval = interval
	log.Printf("Intervalo de sincronização atualizado para %v", interval)
}

// Stop para o serviço de sincronização
func (s *PLCSyncService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return ErrSyncNotRunning
	}

	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
	s.isRunning = false
	return nil
}

// IsRunning verifica se o serviço está em execução
func (s *PLCSyncService) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.isRunning
}

// ForceSync força uma sincronização completa
func (s *PLCSyncService) ForceSync() error {
	if !s.IsRunning() {
		return ErrSyncNotRunning
	}
	return s.performFullSync()
}

// NotifyPLCChange notifica o serviço sobre uma mudança de PLC
func (s *PLCSyncService) NotifyPLCChange(plcID int) {
	s.changeTracker.trackPLCChange(plcID)
}

// NotifyTagChange notifica o serviço sobre uma mudança de tag
func (s *PLCSyncService) NotifyTagChange(tagID int) {
	s.changeTracker.trackTagChange(tagID)
}

// performFullSync realiza uma sincronização completa do PostgreSQL para o Redis
func (s *PLCSyncService) performFullSync() error {
	log.Println("Iniciando sincronização completa PostgreSQL -> Redis")
	startTime := time.Now()

	// 1. Sincronizar PLCs
	plcs, err := s.pgPLCRepo.GetAll()
	if err != nil {
		return fmt.Errorf("erro ao buscar PLCs: %w", err)
	}

	// Usar WaitGroup para paralelizar e um mutex para proteger a contagem de erros
	var wg sync.WaitGroup
	var syncMutex sync.Mutex
	errors := make([]error, 0)
	processed := 0

	for _, plc := range plcs {
		wg.Add(1)
		go func(plc domain.PLC) {
			defer wg.Done()

			// Atualizar ou criar PLC no Redis
			err := s.redisPLCRepo.Update(plc)
			if err == domain.ErrPLCNotFound {
				_, err = s.redisPLCRepo.Create(plc)
			}

			if err != nil {
				syncMutex.Lock()
				errors = append(errors, fmt.Errorf("erro ao sincronizar PLC %d (%s): %w",
					plc.ID, plc.Name, err))
				syncMutex.Unlock()
				return
			}

			// 2. Sincronizar as tags para este PLC
			tags, err := s.pgTagRepo.GetPLCTags(plc.ID)
			if err != nil {
				syncMutex.Lock()
				errors = append(errors, fmt.Errorf("erro ao buscar tags do PLC %d: %w",
					plc.ID, err))
				syncMutex.Unlock()
				return
			}

			// Processar tags deste PLC
			for _, tag := range tags {
				err := s.redisTagRepo.Update(tag)
				if err == domain.ErrPLCTagNotFound {
					_, err = s.redisTagRepo.Create(tag)
				}

				if err != nil {
					syncMutex.Lock()
					errors = append(errors, fmt.Errorf("erro ao sincronizar tag %d (%s): %w",
						tag.ID, tag.Name, err))
					syncMutex.Unlock()
				}
			}

			// Incrementar contador de processados
			syncMutex.Lock()
			processed++
			syncMutex.Unlock()
		}(plc)
	}

	// Aguardar conclusão de todas as goroutines
	wg.Wait()

	// Atualizar timestamp da última sincronização
	s.lastSyncTime = time.Now()

	// Reportar resultados
	duration := time.Since(startTime)
	if len(errors) > 0 {
		log.Printf("Sincronização completa finalizada com %d erros em %v: %d/%d PLCs processados",
			len(errors), duration, processed, len(plcs))

		// Logar os primeiros erros (limitar para não sobrecarregar os logs)
		maxErrors := 5
		if len(errors) <= maxErrors {
			for _, err := range errors {
				log.Printf("Erro de sincronização: %v", err)
			}
		} else {
			for i := 0; i < maxErrors; i++ {
				log.Printf("Erro de sincronização %d/%d: %v", i+1, len(errors), errors[i])
			}
			log.Printf("... e mais %d erros", len(errors)-maxErrors)
		}

		return fmt.Errorf("sincronização completa concluída com %d erros", len(errors))
	}

	log.Printf("Sincronização completa finalizada com sucesso em %v: %d PLCs processados",
		duration, len(plcs))
	return nil
}

// performIncrementalSync realiza uma sincronização incremental
func (s *PLCSyncService) performIncrementalSync() error {
	log.Println("Iniciando sincronização incremental PostgreSQL -> Redis")
	startTime := time.Now()

	// Buscar PLCs e tags modificados desde a última sincronização
	modifiedPLCs := s.changeTracker.getModifiedPLCs(s.lastSyncTime)
	modifiedTags := s.changeTracker.getModifiedTags(s.lastSyncTime)

	// Se temos muitas modificações, pode ser mais eficiente fazer uma sincronização completa
	if len(modifiedPLCs) > 50 || len(modifiedTags) > 200 {
		log.Printf("Muitas modificações detectadas (%d PLCs, %d tags), realizando sync completo",
			len(modifiedPLCs), len(modifiedTags))
		return s.performFullSync()
	}

	// Processar PLCs modificados
	var wg sync.WaitGroup
	var syncMutex sync.Mutex
	errors := make([]error, 0)

	// Sincronizar PLCs modificados
	for _, plcID := range modifiedPLCs {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			if err := s.SyncSpecificPLC(id); err != nil {
				syncMutex.Lock()
				errors = append(errors, fmt.Errorf("erro ao sincronizar PLC %d: %w", id, err))
				syncMutex.Unlock()
			}
		}(plcID)
	}

	// Sincronizar tags modificadas
	for _, tagID := range modifiedTags {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			if err := s.SyncSpecificTag(id); err != nil {
				syncMutex.Lock()
				errors = append(errors, fmt.Errorf("erro ao sincronizar tag %d: %w", id, err))
				syncMutex.Unlock()
			}
		}(tagID)
	}

	// Aguardar conclusão
	wg.Wait()

	// Atualizar timestamp da última sincronização
	s.lastSyncTime = time.Now()

	// Reportar resultados
	duration := time.Since(startTime)
	totalItems := len(modifiedPLCs) + len(modifiedTags)

	if len(errors) > 0 {
		log.Printf("Sincronização incremental finalizada com %d erros em %v: %d itens processados",
			len(errors), duration, totalItems)

		// Logar alguns erros
		maxErrors := 3
		if len(errors) <= maxErrors {
			for _, err := range errors {
				log.Printf("Erro de sincronização: %v", err)
			}
		} else {
			for i := 0; i < maxErrors; i++ {
				log.Printf("Erro de sincronização %d/%d: %v", i+1, len(errors), errors[i])
			}
			log.Printf("... e mais %d erros", len(errors)-maxErrors)
		}

		return fmt.Errorf("sincronização incremental concluída com %d erros", len(errors))
	}

	log.Printf("Sincronização incremental finalizada com sucesso em %v: %d itens processados",
		duration, totalItems)
	return nil
}

// SyncSpecificPLC sincroniza um PLC específico e suas tags
func (s *PLCSyncService) SyncSpecificPLC(plcID int) error {
	log.Printf("Sincronizando PLC específico: %d", plcID)

	// 1. Buscar PLC do PostgreSQL
	plc, err := s.pgPLCRepo.GetByID(plcID)
	if err != nil {
		return fmt.Errorf("erro ao buscar PLC %d: %w", plcID, err)
	}

	// 2. Atualizar ou criar no Redis
	err = s.redisPLCRepo.Update(plc)
	if err != nil {
		// Se não existe, criar
		if err == domain.ErrPLCNotFound {
			_, err = s.redisPLCRepo.Create(plc)
		}
		if err != nil {
			return fmt.Errorf("erro ao sincronizar PLC %d no Redis: %w", plcID, err)
		}
	}

	// 3. Sincronizar as tags
	tags, err := s.pgTagRepo.GetPLCTags(plcID)
	if err != nil {
		return fmt.Errorf("erro ao buscar tags do PLC %d: %w", plcID, err)
	}

	var wg sync.WaitGroup
	var syncMutex sync.Mutex
	errors := make([]error, 0)

	for _, tag := range tags {
		wg.Add(1)
		go func(tag domain.PLCTag) {
			defer wg.Done()

			err := s.redisTagRepo.Update(tag)
			if err != nil {
				// Se não existe, criar
				if err == domain.ErrPLCTagNotFound {
					_, err = s.redisTagRepo.Create(tag)
				}

				if err != nil {
					syncMutex.Lock()
					errors = append(errors, fmt.Errorf("erro ao sincronizar tag %d: %w", tag.ID, err))
					syncMutex.Unlock()
				}
			}
		}(tag)
	}

	wg.Wait()

	if len(errors) > 0 {
		return fmt.Errorf("sincronização do PLC %d concluída com %d erros", plcID, len(errors))
	}

	log.Printf("PLC %d sincronizado com sucesso: %d tags processadas", plcID, len(tags))
	return nil
}

// SyncSpecificTag sincroniza uma tag específica
func (s *PLCSyncService) SyncSpecificTag(tagID int) error {
	// 1. Buscar tag do PostgreSQL
	tag, err := s.pgTagRepo.GetByID(tagID)
	if err != nil {
		return fmt.Errorf("erro ao buscar tag %d: %w", tagID, err)
	}

	// 2. Atualizar ou criar no Redis
	err = s.redisTagRepo.Update(tag)
	if err != nil {
		// Se não existe, criar
		if err == domain.ErrPLCTagNotFound {
			_, err = s.redisTagRepo.Create(tag)
		}
		if err != nil {
			return fmt.Errorf("erro ao sincronizar tag %d no Redis: %w", tagID, err)
		}
	}

	log.Printf("Tag %d sincronizada com sucesso", tagID)
	return nil
}
