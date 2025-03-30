package service

import (
	"app_padrao/internal/domain"
	"context"
	"log"
	"sync"
	"time"
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
}

// NewPLCSyncService cria um novo serviço de sincronização
func NewPLCSyncService(
	pgPLCRepo domain.PLCRepository,
	pgTagRepo domain.PLCTagRepository,
	redisPLCRepo domain.PLCRepository,
	redisTagRepo domain.PLCTagRepository,
	initialImport bool,
) *PLCSyncService {
	ctx, cancel := context.WithCancel(context.Background())

	return &PLCSyncService{
		pgPLCRepo:     pgPLCRepo,
		pgTagRepo:     pgTagRepo,
		redisPLCRepo:  redisPLCRepo,
		redisTagRepo:  redisTagRepo,
		ctx:           ctx,
		cancel:        cancel,
		syncInterval:  time.Minute * 5, // Sincronizar a cada 5 minutos
		initialImport: initialImport,
	}
}

// Start inicia o serviço de sincronização
func (s *PLCSyncService) Start() error {
	log.Println("Iniciando serviço de sincronização PostgreSQL -> Redis")

	// Fazer importação inicial se necessário
	if s.initialImport {
		if err := s.performFullSync(); err != nil {
			log.Printf("Erro na sincronização inicial: %v", err)
			return err
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

// Stop para o serviço de sincronização
func (s *PLCSyncService) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
}

// performFullSync realiza uma sincronização completa do PostgreSQL para o Redis
func (s *PLCSyncService) performFullSync() error {
	log.Println("Iniciando sincronização completa PostgreSQL -> Redis")

	// 1. Sincronizar PLCs
	plcs, err := s.pgPLCRepo.GetAll()
	if err != nil {
		return err
	}

	for _, plc := range plcs {
		_, err := s.redisPLCRepo.Create(plc)
		if err != nil {
			log.Printf("Erro ao importar PLC %d (%s) para Redis: %v", plc.ID, plc.Name, err)
			// Continuar mesmo com erro
		}

		// 2. Sincronizar as tags para cada PLC
		tags, err := s.pgTagRepo.GetPLCTags(plc.ID)
		if err != nil {
			log.Printf("Erro ao buscar tags do PLC %d: %v", plc.ID, err)
			continue
		}

		for _, tag := range tags {
			_, err := s.redisTagRepo.Create(tag)
			if err != nil {
				log.Printf("Erro ao importar tag %d (%s) para Redis: %v", tag.ID, tag.Name, err)
				// Continuar mesmo com erro
			}
		}
	}

	log.Printf("Sincronização completa finalizada: %d PLCs processados", len(plcs))
	return nil
}

// performIncrementalSync realiza uma sincronização incremental
// Para uma aplicação real, seria necessário um mecanismo mais sofisticado
// com timestamps ou contadores de modificação para determinar quais dados mudaram
func (s *PLCSyncService) performIncrementalSync() error {
	log.Println("Iniciando sincronização incremental PostgreSQL -> Redis")

	// Simplified approach: we'll just update all PLCs to ensure consistency
	// A more efficient approach would track changes in the database
	return s.performFullSync()
}

// SyncSpecificPLC sincroniza um PLC específico e suas tags
func (s *PLCSyncService) SyncSpecificPLC(plcID int) error {
	log.Printf("Sincronizando PLC específico: %d", plcID)

	// 1. Buscar PLC do PostgreSQL
	plc, err := s.pgPLCRepo.GetByID(plcID)
	if err != nil {
		return err
	}

	// 2. Atualizar ou criar no Redis
	err = s.redisPLCRepo.Update(plc)
	if err != nil {
		// Se não existe, criar
		if err == domain.ErrPLCNotFound {
			_, err = s.redisPLCRepo.Create(plc)
		}
		if err != nil {
			return err
		}
	}

	// 3. Sincronizar as tags
	tags, err := s.pgTagRepo.GetPLCTags(plcID)
	if err != nil {
		return err
	}

	for _, tag := range tags {
		err = s.redisTagRepo.Update(tag)
		if err != nil {
			// Se não existe, criar
			if err == domain.ErrPLCTagNotFound {
				_, err = s.redisTagRepo.Create(tag)
			}
			if err != nil {
				log.Printf("Erro ao sincronizar tag %d: %v", tag.ID, err)
				// Continuar com as outras tags mesmo com erro
			}
		}
	}

	log.Printf("PLC %d sincronizado com sucesso: %d tags processadas", plcID, len(tags))
	return nil
}

// SyncSpecificTag sincroniza uma tag específica
func (s *PLCSyncService) SyncSpecificTag(tagID int) error {
	// 1. Buscar tag do PostgreSQL
	tag, err := s.pgTagRepo.GetByID(tagID)
	if err != nil {
		return err
	}

	// 2. Atualizar ou criar no Redis
	err = s.redisTagRepo.Update(tag)
	if err != nil {
		// Se não existe, criar
		if err == domain.ErrPLCTagNotFound {
			_, err = s.redisTagRepo.Create(tag)
		}
		if err != nil {
			return err
		}
	}

	log.Printf("Tag %d sincronizada com sucesso", tagID)
	return nil
}
