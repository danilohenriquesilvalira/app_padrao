package service

import (
	"app_padrao/internal/domain"
	"app_padrao/internal/repository"
	"fmt"
	"log"
	"strings"
	"time"
)

// PLCService implementa a interface domain.PLCService
type PLCService struct {
	// Repositórios PostgreSQL (persistência principal)
	pgPLCRepo domain.PLCRepository
	pgTagRepo domain.PLCTagRepository

	// Repositórios Redis (cache de operação)
	redisPLCRepo domain.PLCRepository
	redisTagRepo domain.PLCTagRepository

	// Cache Redis para valores de tags
	cache domain.PLCCache

	// Gerenciador de PLCs
	manager *PLCManager

	// Serviço de sincronização
	syncService *PLCSyncService

	// Estado
	isRunning bool
}

// NewPLCService cria um novo serviço de PLC
func NewPLCService(
	pgPLCRepo domain.PLCRepository,
	pgTagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
) *PLCService {
	// Obter o cliente Redis do cache
	redisClient := cache.GetRedisClient()

	// Criar repositórios Redis
	redisPLCRepo := repository.NewPLCRedisRepository(redisClient)
	redisTagRepo := repository.NewPLCTagRedisRepository(redisClient)

	// Inicializar serviço
	s := &PLCService{
		pgPLCRepo:    pgPLCRepo,
		pgTagRepo:    pgTagRepo,
		redisPLCRepo: redisPLCRepo,
		redisTagRepo: redisTagRepo,
		cache:        cache,
		isRunning:    false,
	}

	// Criar serviço de sincronização
	s.syncService = NewPLCSyncService(
		pgPLCRepo,
		pgTagRepo,
		redisPLCRepo,
		redisTagRepo,
		true, // Fazer importação inicial
	)

	// Criar gerenciador de PLCs
	s.manager = NewPLCManager(redisPLCRepo, redisTagRepo, cache)

	return s
}

// GetByID busca um PLC pelo ID
func (s *PLCService) GetByID(id int) (domain.PLC, error) {
	// Primeiro tentar no Redis para resposta mais rápida
	plc, err := s.redisPLCRepo.GetByID(id)
	if err == nil {
		return plc, nil
	}

	// Se não encontrar no Redis, buscar no PostgreSQL
	plc, err = s.pgPLCRepo.GetByID(id)
	if err != nil {
		return domain.PLC{}, err
	}

	// Armazenar no Redis para acessos futuros
	_, err = s.redisPLCRepo.Create(plc)
	if err != nil {
		log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", id, err)
	}

	return plc, nil
}

// GetAll retorna todos os PLCs
func (s *PLCService) GetAll() ([]domain.PLC, error) {
	// Tentar Redis primeiro
	plcs, err := s.redisPLCRepo.GetAll()
	if err == nil && len(plcs) > 0 {
		return plcs, nil
	}

	// Se não houver dados no Redis, buscar do PostgreSQL
	plcs, err = s.pgPLCRepo.GetAll()
	if err != nil {
		return nil, err
	}

	// Armazenar no Redis para futuras consultas
	for _, plc := range plcs {
		_, err := s.redisPLCRepo.Create(plc)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", plc.ID, err)
		}
	}

	return plcs, nil
}

// GetActivePLCs retorna PLCs ativos
func (s *PLCService) GetActivePLCs() ([]domain.PLC, error) {
	// Tentar Redis primeiro
	plcs, err := s.redisPLCRepo.GetActivePLCs()
	if err == nil && len(plcs) > 0 {
		return plcs, nil
	}

	// Se não houver dados no Redis, buscar do PostgreSQL
	plcs, err = s.pgPLCRepo.GetActivePLCs()
	if err != nil {
		return nil, err
	}

	// Armazenar no Redis para futuras consultas
	for _, plc := range plcs {
		_, err := s.redisPLCRepo.Create(plc)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", plc.ID, err)
		}
	}

	return plcs, nil
}

// Create cria um novo PLC
func (s *PLCService) Create(plc domain.PLC) (int, error) {
	// Validações
	if plc.Name == "" {
		return 0, fmt.Errorf("nome do PLC é obrigatório")
	}

	if plc.IPAddress == "" {
		return 0, fmt.Errorf("endereço IP do PLC é obrigatório")
	}

	// Definir data de criação
	plc.CreatedAt = time.Now()

	// Criar no banco de dados principal (persistência)
	id, err := s.pgPLCRepo.Create(plc)
	if err != nil {
		return 0, err
	}

	// Definir ID retornado
	plc.ID = id

	// Criar no Redis também
	_, err = s.redisPLCRepo.Create(plc)
	if err != nil {
		log.Printf("Aviso: erro ao armazenar novo PLC no Redis: %v", err)
		// Continuar mesmo com erro no Redis
	}

	return id, nil
}

// Update atualiza um PLC
func (s *PLCService) Update(plc domain.PLC) error {
	// Validações
	if plc.Name == "" {
		return fmt.Errorf("nome do PLC é obrigatório")
	}

	if plc.IPAddress == "" {
		return fmt.Errorf("endereço IP do PLC é obrigatório")
	}

	// Atualizar data
	plc.UpdatedAt = time.Now()

	// Atualizar no banco de dados principal
	err := s.pgPLCRepo.Update(plc)
	if err != nil {
		return err
	}

	// Atualizar no Redis também
	err = s.redisPLCRepo.Update(plc)
	if err != nil {
		log.Printf("Aviso: erro ao atualizar PLC no Redis: %v", err)
		// Tentar criar caso não exista
		_, err = s.redisPLCRepo.Create(plc)
		if err != nil {
			log.Printf("Aviso: erro ao criar PLC no Redis após falha na atualização: %v", err)
		}
	}

	return nil
}

// Delete remove um PLC
func (s *PLCService) Delete(id int) error {
	// Excluir tags associadas primeiro
	tags, err := s.GetPLCTags(id)
	if err == nil {
		for _, tag := range tags {
			err := s.DeleteTag(tag.ID)
			if err != nil {
				log.Printf("Aviso: erro ao excluir tag %d do PLC %d: %v", tag.ID, id, err)
			}
		}
	}

	// Excluir do banco de dados principal
	err = s.pgPLCRepo.Delete(id)
	if err != nil {
		return err
	}

	// Excluir do Redis também
	err = s.redisPLCRepo.Delete(id)
	if err != nil {
		log.Printf("Aviso: erro ao excluir PLC do Redis: %v", err)
	}

	return nil
}

// GetPLCTags busca as tags de um PLC
func (s *PLCService) GetPLCTags(plcID int) ([]domain.PLCTag, error) {
	// Tentar buscar do Redis primeiro
	tags, err := s.redisTagRepo.GetPLCTags(plcID)
	if err == nil && len(tags) > 0 {
		// Carregar valores atuais das tags
		for i := range tags {
			tagValue, err := s.cache.GetTagValue(plcID, tags[i].ID)
			if err == nil && tagValue != nil {
				tags[i].CurrentValue = tagValue.Value
			}
		}
		return tags, nil
	}

	// Se não encontrar no Redis, buscar do PostgreSQL
	tags, err = s.pgTagRepo.GetPLCTags(plcID)
	if err != nil {
		return nil, err
	}

	// Armazenar no Redis para futuras consultas
	for _, tag := range tags {
		_, err := s.redisTagRepo.Create(tag)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", tag.ID, err)
		}

		// Carregar valor atual, se disponível
		tagValue, err := s.cache.GetTagValue(plcID, tag.ID)
		if err == nil && tagValue != nil {
			tag.CurrentValue = tagValue.Value
		}
	}

	return tags, nil
}

// GetTagByID busca uma tag pelo ID
func (s *PLCService) GetTagByID(id int) (domain.PLCTag, error) {
	// Tentar buscar do Redis primeiro
	tag, err := s.redisTagRepo.GetByID(id)
	if err == nil {
		// Carregar valor atual
		tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
		if err == nil && tagValue != nil {
			tag.CurrentValue = tagValue.Value
		}
		return tag, nil
	}

	// Se não encontrar no Redis, buscar do PostgreSQL
	tag, err = s.pgTagRepo.GetByID(id)
	if err != nil {
		return domain.PLCTag{}, err
	}

	// Armazenar no Redis para futuras consultas
	_, err = s.redisTagRepo.Create(tag)
	if err != nil {
		log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", id, err)
	}

	// Carregar valor atual
	tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
	if err == nil && tagValue != nil {
		tag.CurrentValue = tagValue.Value
	}

	return tag, nil
}

// GetTagByName busca tags pelo nome
func (s *PLCService) GetTagByName(name string) ([]domain.PLCTag, error) {
	// Tentar buscar do Redis primeiro
	tags, err := s.redisTagRepo.GetByName(name)
	if err == nil && len(tags) > 0 {
		// Carregar valores atuais
		for i := range tags {
			tagValue, err := s.cache.GetTagValue(tags[i].PLCID, tags[i].ID)
			if err == nil && tagValue != nil {
				tags[i].CurrentValue = tagValue.Value
			}
		}
		return tags, nil
	}

	// Se não encontrar no Redis, buscar do PostgreSQL
	tags, err = s.pgTagRepo.GetByName(name)
	if err != nil {
		return nil, err
	}

	// Armazenar no Redis para futuras consultas
	for _, tag := range tags {
		_, err := s.redisTagRepo.Create(tag)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", tag.ID, err)
		}

		// Carregar valor atual
		tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
		if err == nil && tagValue != nil {
			tag.CurrentValue = tagValue.Value
		}
	}

	return tags, nil
}

// CreateTag cria uma nova tag
func (s *PLCService) CreateTag(tag domain.PLCTag) (int, error) {
	// Validações
	if tag.Name == "" {
		return 0, fmt.Errorf("nome da tag é obrigatório")
	}

	if tag.DataType == "" {
		return 0, fmt.Errorf("tipo de dados da tag é obrigatório")
	}

	// Normalizar o tipo de dados para evitar problemas de case-sensitivity
	tag.DataType = strings.ToLower(strings.TrimSpace(tag.DataType))

	// Validar tipo de dados com verificação mais rigorosa
	validTypes := map[string]bool{
		"real":   true,
		"int":    true,
		"word":   true,
		"bool":   true,
		"string": true,
		"dint":   true,
		"dword":  true,
		"int16":  true,
		"int32":  true,
		"uint16": true,
		"uint32": true,
		"sint":   true,
		"usint":  true,
		"byte":   true,
		"int8":   true,
		"uint8":  true,
	}

	if !validTypes[tag.DataType] {
		return 0, fmt.Errorf("tipo de dados '%s' não é suportado. Tipos válidos: real, int, word, bool, string, etc", tag.DataType)
	}

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			return 0, fmt.Errorf("bit offset deve estar entre 0 e 7 para tipo bool")
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0

		// Log para debug
		log.Printf("CreateTag: Configurando tag '%s' com tipo '%s', o bit offset foi definido como 0",
			tag.Name, tag.DataType)
	}

	// Verificar se o PLC existe
	_, err := s.GetByID(tag.PLCID)
	if err != nil {
		return 0, err
	}

	// Definir valores padrão
	tag.CreatedAt = time.Now()
	if tag.ScanRate <= 0 {
		tag.ScanRate = 1000 // Padrão: 1 segundo
	}

	// Criar no banco de dados principal
	id, err := s.pgTagRepo.Create(tag)
	if err != nil {
		return 0, err
	}

	// Definir ID
	tag.ID = id

	// Criar no Redis também
	_, err = s.redisTagRepo.Create(tag)
	if err != nil {
		log.Printf("Aviso: erro ao armazenar nova tag no Redis: %v", err)
	} else {
		// Log adicional para confirmar criação com sucesso
		log.Printf("Tag criada com sucesso - ID: %d, Nome: %s, Tipo: %s, DB: %d, Byte: %d, Bit: %d",
			id, tag.Name, tag.DataType, tag.DBNumber, tag.ByteOffset, tag.BitOffset)
	}

	return id, nil
}

// UpdateTag atualiza uma tag
func (s *PLCService) UpdateTag(tag domain.PLCTag) error {
	// Validações
	if tag.Name == "" {
		return fmt.Errorf("nome da tag é obrigatório")
	}

	if tag.DataType == "" {
		return fmt.Errorf("tipo de dados da tag é obrigatório")
	}

	// Normalizar o tipo de dados para evitar problemas de case-sensitivity
	tag.DataType = strings.ToLower(strings.TrimSpace(tag.DataType))

	// Validar tipo de dados com verificação mais rigorosa
	validTypes := map[string]bool{
		"real":   true,
		"int":    true,
		"word":   true,
		"bool":   true,
		"string": true,
		"dint":   true,
		"dword":  true,
		"int16":  true,
		"int32":  true,
		"uint16": true,
		"uint32": true,
		"sint":   true,
		"usint":  true,
		"byte":   true,
		"int8":   true,
		"uint8":  true,
	}

	if !validTypes[tag.DataType] {
		return fmt.Errorf("tipo de dados '%s' não é suportado", tag.DataType)
	}

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			return fmt.Errorf("bit offset deve estar entre 0 e 7 para tipo bool")
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0

		// Log para debug
		log.Printf("UpdateTag: Configurando tag '%s' com tipo '%s', o bit offset foi definido como 0",
			tag.Name, tag.DataType)
	}

	// Verificar se o PLC existe
	_, err := s.GetByID(tag.PLCID)
	if err != nil {
		return err
	}

	// Atualizar data
	tag.UpdatedAt = time.Now()

	// Definir valores padrão
	if tag.ScanRate <= 0 {
		tag.ScanRate = 1000 // Padrão: 1 segundo
	}

	// Atualizar no banco de dados principal
	err = s.pgTagRepo.Update(tag)
	if err != nil {
		return err
	}

	// Atualizar no Redis também
	err = s.redisTagRepo.Update(tag)
	if err != nil {
		log.Printf("Aviso: erro ao atualizar tag no Redis: %v", err)
		// Tentar criar caso não exista
		_, err = s.redisTagRepo.Create(tag)
		if err != nil {
			log.Printf("Aviso: erro ao criar tag no Redis após falha na atualização: %v", err)
		}
	} else {
		// Log adicional para confirmar atualização com sucesso
		log.Printf("Tag atualizada com sucesso - ID: %d, Nome: %s, Tipo: %s, DB: %d, Byte: %d, Bit: %d",
			tag.ID, tag.Name, tag.DataType, tag.DBNumber, tag.ByteOffset, tag.BitOffset)
	}

	return nil
}

// DeleteTag remove uma tag
func (s *PLCService) DeleteTag(id int) error {
	// Buscar tag antes de excluir apenas para verificar se existe
	_, err := s.GetTagByID(id)
	if err != nil {
		return err
	}

	// Excluir do banco de dados principal
	err = s.pgTagRepo.Delete(id)
	if err != nil {
		return err
	}

	// Excluir do Redis também
	err = s.redisTagRepo.Delete(id)
	if err != nil {
		log.Printf("Aviso: erro ao excluir tag do Redis: %v", err)
	}

	return nil
}

// StartMonitoring inicia o monitoramento de PLCs
func (s *PLCService) StartMonitoring() error {
	if s.isRunning {
		return fmt.Errorf("monitoramento já está em execução")
	}

	// Iniciar serviço de sincronização
	err := s.syncService.Start()
	if err != nil {
		return fmt.Errorf("erro ao iniciar sincronização: %v", err)
	}

	// Iniciar gerenciador de PLCs
	err = s.manager.Start()
	if err != nil {
		s.syncService.Stop()
		return fmt.Errorf("erro ao iniciar gerenciador de PLCs: %v", err)
	}

	s.isRunning = true
	log.Println("Serviço de monitoramento de PLCs iniciado")
	return nil
}

// StopMonitoring para o monitoramento de PLCs
func (s *PLCService) StopMonitoring() error {
	if !s.isRunning {
		return nil
	}

	// Parar gerenciador
	s.manager.Stop()

	// Parar sincronização
	s.syncService.Stop()

	s.isRunning = false
	log.Println("Serviço de monitoramento de PLCs parado")
	return nil
}

// WriteTagValue escreve um valor em uma tag pelo nome
func (s *PLCService) WriteTagValue(tagName string, value interface{}) error {
	return s.manager.WriteTagByName(tagName, value)
}

// GetTagValue busca o valor atual de uma tag
func (s *PLCService) GetTagValue(plcID int, tagID int) (*domain.TagValue, error) {
	return s.cache.GetTagValue(plcID, tagID)
}

// GetPLCStats retorna estatísticas do gerenciador de PLCs
func (s *PLCService) GetPLCStats() domain.PLCManagerStats {
	// Converter o tipo PLCManagerStats para domain.PLCManagerStats
	stats := s.manager.GetStats()

	// Criar uma nova instância do tipo domain.PLCManagerStats
	domainStats := domain.PLCManagerStats{
		ActivePLCs:      stats.ActivePLCs,
		TotalTags:       stats.TotalTags,
		TagsRead:        stats.TagsRead,
		TagsWritten:     stats.TagsWritten,
		ReadErrors:      stats.ReadErrors,
		WriteErrors:     stats.WriteErrors,
		LastUpdated:     stats.LastUpdated,
		ConnectionStats: make(map[int]domain.PLCConnectionStats, len(stats.ConnectionStats)),
	}

	// Converter cada ConnectionStat para domain.PLCConnectionStats
	for id, connStat := range stats.ConnectionStats {
		domainStats.ConnectionStats[id] = domain.PLCConnectionStats{
			PLCID:         connStat.PLCID,
			Name:          connStat.Name,
			Status:        connStat.Status,
			TagCount:      connStat.TagCount,
			LastConnected: connStat.LastConnected,
			ReadErrors:    connStat.ReadErrors,
			WriteErrors:   connStat.WriteErrors,
		}
	}

	return domainStats
}

// StartDebugMonitor inicia uma rotina que imprime periodicamente os valores de todas as tags
func (s *PLCService) StartDebugMonitor() {
	// Verificar se o monitoramento está rodando
	if !s.isRunning {
		log.Println("DEPURAÇÃO: Não é possível iniciar o monitor de depuração porque o serviço PLC não está em execução")
		return
	}

	log.Println("DEPURAÇÃO: Iniciando monitor de depuração para valores de tags")

	// Iniciar uma goroutine para imprimir valores periodicamente
	go func() {
		ticker := time.NewTicker(5 * time.Second) // Ajuste o intervalo conforme necessário
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// Obter todos os PLCs ativos
				plcs, err := s.GetActivePLCs()
				if err != nil {
					log.Printf("DEPURAÇÃO: Erro ao buscar PLCs ativos: %v", err)
					continue
				}

				if len(plcs) == 0 {
					log.Println("DEPURAÇÃO: Nenhum PLC ativo encontrado")
					continue
				}

				// Para cada PLC, buscar suas tags
				for _, plc := range plcs {
					tags, err := s.GetPLCTags(plc.ID)
					if err != nil {
						log.Printf("DEPURAÇÃO: Erro ao buscar tags do PLC %s (ID=%d): %v",
							plc.Name, plc.ID, err)
						continue
					}

					if len(tags) == 0 {
						log.Printf("DEPURAÇÃO: PLC %s (ID=%d) não tem tags", plc.Name, plc.ID)
						continue
					}

					// Imprimir cabeçalho
					log.Printf("=== VALORES ATUAIS DO PLC %s (STATUS: %s) ===", plc.Name, plc.Status)

					// Imprimir cada tag com seu valor
					for _, tag := range tags {
						if !tag.Active {
							continue
						}

						// Buscar o valor mais recente do cache
						tagValue, err := s.cache.GetTagValue(plc.ID, tag.ID)

						var valorStr string
						if err != nil || tagValue == nil {
							valorStr = "<sem valor>"
						} else {
							// Formatação mais legível do valor
							switch tag.DataType {
							case "real":
								if v, ok := tagValue.Value.(float32); ok {
									valorStr = fmt.Sprintf("%.3f", v)
								} else {
									valorStr = fmt.Sprintf("%v", tagValue.Value)
								}
							case "bool":
								if v, ok := tagValue.Value.(bool); ok {
									if v {
										valorStr = "TRUE"
									} else {
										valorStr = "FALSE"
									}
								} else {
									valorStr = fmt.Sprintf("%v", tagValue.Value)
								}
							default:
								valorStr = fmt.Sprintf("%v", tagValue.Value)
							}
						}

						log.Printf("  Tag: %-20s | Tipo: %-6s | DB%d.DBX%d.%d | Valor: %s",
							tag.Name,
							tag.DataType,
							tag.DBNumber,
							int(tag.ByteOffset),
							tag.BitOffset,
							valorStr)
					}

					log.Println("=============================================")
				}
			}
		}
	}()
}

// VerifyTagAddresses verifica se os endereços das tags correspondem aos do PLC real
func (s *PLCService) VerifyTagAddresses() error {
	log.Println("Verificando endereços das tags...")

	// Obter todos os PLCs
	plcs, err := s.GetAll()
	if err != nil {
		return fmt.Errorf("erro ao buscar PLCs: %v", err)
	}

	for _, plc := range plcs {
		log.Printf("Verificando tags do PLC %s (ID=%d)", plc.Name, plc.ID)

		// Obter tags do PLC
		tags, err := s.GetPLCTags(plc.ID)
		if err != nil {
			log.Printf("Erro ao buscar tags do PLC %d: %v", plc.ID, err)
			continue
		}

		// Verificar cada tag
		for _, tag := range tags {
			// Exemplos para a DB11 conforme mostrado na captura de tela
			if tag.DBNumber == 11 {
				// Verificar nomes conhecidos e corrigir se necessário
				needsUpdate := false

				if tag.Name == "bit" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 0) {
					tag.ByteOffset = 0
					tag.BitOffset = 0
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit' para DB11.DBX0.0")
				}

				if tag.Name == "bit_1" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 1) {
					tag.ByteOffset = 0
					tag.BitOffset = 1
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_1' para DB11.DBX0.1")
				}

				if tag.Name == "bit_2" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 2) {
					tag.ByteOffset = 0
					tag.BitOffset = 2
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_2' para DB11.DBX0.2")
				}

				if tag.Name == "bit_3" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 3) {
					tag.ByteOffset = 0
					tag.BitOffset = 3
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_3' para DB11.DBX0.3")
				}

				if tag.Name == "bit_4" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 4) {
					tag.ByteOffset = 0
					tag.BitOffset = 4
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_4' para DB11.DBX0.4")
				}

				if tag.Name == "bit_5" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 5) {
					tag.ByteOffset = 0
					tag.BitOffset = 5
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_5' para DB11.DBX0.5")
				}

				if tag.Name == "bit_6" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 6) {
					tag.ByteOffset = 0
					tag.BitOffset = 6
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_6' para DB11.DBX0.6")
				}

				if tag.Name == "bit_7" && (int(tag.ByteOffset) != 0 || tag.BitOffset != 7) {
					tag.ByteOffset = 0
					tag.BitOffset = 7
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_7' para DB11.DBX0.7")
				}

				if tag.Name == "bit_8" && (int(tag.ByteOffset) != 1 || tag.BitOffset != 0) {
					tag.ByteOffset = 1
					tag.BitOffset = 0
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_8' para DB11.DBX1.0")
				}

				if tag.Name == "bit_9" && (int(tag.ByteOffset) != 1 || tag.BitOffset != 1) {
					tag.ByteOffset = 1
					tag.BitOffset = 1
					tag.DataType = "bool"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'bit_9' para DB11.DBX1.1")
				}

				// Inteiros
				if tag.Name == "int" && (int(tag.ByteOffset) != 2 || tag.DataType != "int") {
					tag.ByteOffset = 2
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int' para DB11.DBX2.0")
				}

				if tag.Name == "int_1" && (int(tag.ByteOffset) != 4 || tag.DataType != "int") {
					tag.ByteOffset = 4
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int_1' para DB11.DBX4.0")
				}

				if tag.Name == "int_2" && (int(tag.ByteOffset) != 6 || tag.DataType != "int") {
					tag.ByteOffset = 6
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int_2' para DB11.DBX6.0")
				}

				if tag.Name == "int_3" && (int(tag.ByteOffset) != 8 || tag.DataType != "int") {
					tag.ByteOffset = 8
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int_3' para DB11.DBX8.0")
				}

				if tag.Name == "int_4" && (int(tag.ByteOffset) != 10 || tag.DataType != "int") {
					tag.ByteOffset = 10
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int_4' para DB11.DBX10.0")
				}

				if tag.Name == "int_5" && (int(tag.ByteOffset) != 12 || tag.DataType != "int") {
					tag.ByteOffset = 12
					tag.BitOffset = 0
					tag.DataType = "int"
					needsUpdate = true
					log.Printf("Corrigindo endereço da tag 'int_5' para DB11.DBX12.0")
				}

				// Se precisar atualizar, chama o método UpdateTag
				if needsUpdate {
					if err := s.UpdateTag(tag); err != nil {
						log.Printf("Erro ao atualizar tag %s (ID=%d): %v", tag.Name, tag.ID, err)
					} else {
						log.Printf("Tag %s atualizada com sucesso", tag.Name)
					}
				}
			}
		}
	}

	log.Println("Verificação e correção de endereços concluída")
	return nil
}

// Método adicional para verificar a saúde das conexões com PLCs
func (s *PLCService) CheckPLCHealth() (map[int]string, error) {
	health := make(map[int]string)

	// Obter todos os PLCs ativos
	plcs, err := s.GetActivePLCs()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs ativos: %v", err)
	}

	for _, plc := range plcs {
		// Tentar recuperar a conexão através do gerenciador
		conn, err := s.manager.GetConnectionByPLCID(plc.ID)
		if err != nil {
			health[plc.ID] = "offline: " + err.Error()
			continue
		}

		// Verificar a conexão com ping
		if err := conn.Ping(); err != nil {
			health[plc.ID] = "falha: " + err.Error()
		} else {
			health[plc.ID] = "online"
		}
	}

	return health, nil
}

// ResetPLCConnection força a reconexão com um PLC específico
func (s *PLCService) ResetPLCConnection(plcID int) error {
	// Verificar se o PLC existe
	plc, err := s.GetByID(plcID)
	if err != nil {
		return err
	}

	log.Printf("Solicitada reconexão com PLC %s (ID=%d)", plc.Name, plc.ID)

	// Se o gerenciador estiver em execução
	if s.isRunning && s.manager != nil {
		// Fechar a conexão atual se existir
		s.manager.connectionsMutex.Lock()
		if conn, exists := s.manager.activeConnections[plcID]; exists {
			conn.Close()
			delete(s.manager.activeConnections, plcID)
			log.Printf("Conexão existente com PLC %d fechada", plcID)
		}
		s.manager.connectionsMutex.Unlock()

		// Atualizar o status do PLC para reiniciar o monitoramento
		err = s.pgPLCRepo.UpdatePLCStatus(domain.PLCStatus{
			PLCID:      plcID,
			Status:     "reconnecting",
			LastUpdate: time.Now(),
		})
		if err != nil {
			log.Printf("Erro ao atualizar status do PLC %d: %v", plcID, err)
		}

		return nil
	}

	return fmt.Errorf("o serviço de monitoramento não está em execução")
}

// GetStatistics retorna estatísticas mais detalhadas do sistema
func (s *PLCService) GetStatistics() map[string]interface{} {
	stats := make(map[string]interface{})

	// Estatísticas do gerenciador
	if s.manager != nil {
		managerStats := s.manager.GetStats()
		stats["manager"] = managerStats
	}

	// Contar PLCs por status
	plcs, err := s.GetAll()
	if err == nil {
		statusCount := make(map[string]int)
		for _, plc := range plcs {
			statusCount[plc.Status]++
		}
		stats["plc_status"] = statusCount
		stats["total_plcs"] = len(plcs)
	}

	// Contar total de tags
	totalTags := 0
	activeTags := 0
	tagsPerPLC := make(map[int]int)

	for _, plc := range plcs {
		tags, err := s.GetPLCTags(plc.ID)
		if err == nil {
			tagsPerPLC[plc.ID] = len(tags)
			totalTags += len(tags)

			for _, tag := range tags {
				if tag.Active {
					activeTags++
				}
			}
		}
	}

	stats["total_tags"] = totalTags
	stats["active_tags"] = activeTags
	stats["tags_per_plc"] = tagsPerPLC

	return stats
}

// DiagnosticTags verifica a configuração de todas as tags e tenta corrigir inconsistências
func (s *PLCService) DiagnosticTags() (map[string]interface{}, error) {
	results := make(map[string]interface{})
	var fixedTags, errorTags int

	// Obter todos os PLCs
	plcs, err := s.GetAll()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs: %v", err)
	}

	plcResults := make(map[int]map[string]interface{})

	for _, plc := range plcs {
		plcResult := make(map[string]interface{})
		plcResult["name"] = plc.Name

		// Buscar todas as tags do PLC
		tags, err := s.GetPLCTags(plc.ID)
		if err != nil {
			plcResult["error"] = fmt.Sprintf("erro ao buscar tags: %v", err)
			plcResults[plc.ID] = plcResult
			errorTags++
			continue
		}

		tagIssues := make([]map[string]interface{}, 0)

		for _, tag := range tags {
			// Verifica problemas com a tag
			if tag.DataType == "" {
				issue := map[string]interface{}{
					"tag_id":   tag.ID,
					"tag_name": tag.Name,
					"issue":    "Tipo de dados ausente",
					"action":   "Definido como 'word'",
				}
				tagIssues = append(tagIssues, issue)

				// Corrigir a tag
				tag.DataType = "word"
				if err := s.UpdateTag(tag); err != nil {
					issue["result"] = fmt.Sprintf("Erro ao corrigir: %v", err)
					errorTags++
				} else {
					issue["result"] = "Corrigido com sucesso"
					fixedTags++
				}
			} else if tag.DataType == "bool" && (tag.BitOffset < 0 || tag.BitOffset > 7) {
				issue := map[string]interface{}{
					"tag_id":   tag.ID,
					"tag_name": tag.Name,
					"issue":    fmt.Sprintf("Bit offset inválido (%d) para tipo bool", tag.BitOffset),
					"action":   "Corrigido para valor entre 0 e 7",
				}
				tagIssues = append(tagIssues, issue)

				// Corrigir bit offset
				tag.BitOffset = tag.BitOffset % 8
				if tag.BitOffset < 0 {
					tag.BitOffset = 0
				}

				if err := s.UpdateTag(tag); err != nil {
					issue["result"] = fmt.Sprintf("Erro ao corrigir: %v", err)
					errorTags++
				} else {
					issue["result"] = "Corrigido com sucesso"
					fixedTags++
				}
			} else if tag.DataType != "bool" && tag.BitOffset != 0 {
				issue := map[string]interface{}{
					"tag_id":   tag.ID,
					"tag_name": tag.Name,
					"issue": fmt.Sprintf("Bit offset (%d) definido para tipo não booleano (%s)",
						tag.BitOffset, tag.DataType),
					"action": "Bit offset definido como 0",
				}
				tagIssues = append(tagIssues, issue)

				// Corrigir bit offset
				tag.BitOffset = 0

				if err := s.UpdateTag(tag); err != nil {
					issue["result"] = fmt.Sprintf("Erro ao corrigir: %v", err)
					errorTags++
				} else {
					issue["result"] = "Corrigido com sucesso"
					fixedTags++
				}
			}
		}

		plcResult["tags_count"] = len(tags)
		plcResult["issues"] = tagIssues
		plcResults[plc.ID] = plcResult
	}

	results["plcs"] = plcResults
	results["fixed_tags"] = fixedTags
	results["error_tags"] = errorTags
	results["timestamp"] = time.Now().Format(time.RFC3339)

	return results, nil
}
