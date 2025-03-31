// internal/service/plc.go
package service

import (
	"app_padrao/internal/domain"
	"app_padrao/internal/repository"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// Erros específicos do serviço PLC
var (
	ErrInvalidPLCName      = errors.New("nome do PLC é obrigatório")
	ErrInvalidIPAddress    = errors.New("endereço IP do PLC é obrigatório")
	ErrInvalidTagName      = errors.New("nome da tag é obrigatório")
	ErrInvalidDataType     = errors.New("tipo de dados da tag é obrigatório ou inválido")
	ErrInvalidBitOffset    = errors.New("bit offset deve estar entre 0 e 7 para tipo bool")
	ErrPLCNotActive        = errors.New("PLC não está ativo")
	ErrMonitoringNotActive = errors.New("serviço de monitoramento não está ativo")
)

// PLCConfig contém configurações para o serviço PLC
type PLCConfig struct {
	MonitoringEnabled      bool
	DetailedLoggingEnabled bool
	CacheEnabled           bool
	MaxRetryAttempts       int
	RetryInterval          time.Duration
	DefaultTagScanRate     int
}

// DefaultPLCConfig retorna uma configuração padrão
func DefaultPLCConfig() PLCConfig {
	return PLCConfig{
		MonitoringEnabled:      true,
		DetailedLoggingEnabled: true,
		CacheEnabled:           true,
		MaxRetryAttempts:       3,
		RetryInterval:          2 * time.Second,
		DefaultTagScanRate:     1000, // 1 segundo
	}
}

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
	mu        sync.RWMutex // protege o estado isRunning

	// Configuração
	config PLCConfig

	// Mapeamento de endereços corretos para referência
	addressMap map[string]map[string]struct {
		DBNumber   int
		ByteOffset int
		BitOffset  int
		DataType   string
	}
}

// NewPLCService cria um novo serviço de PLC
func NewPLCService(
	pgPLCRepo domain.PLCRepository,
	pgTagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
) *PLCService {
	// Usar configuração padrão
	config := DefaultPLCConfig()
	return NewPLCServiceWithConfig(pgPLCRepo, pgTagRepo, cache, config)
}

// NewPLCServiceWithConfig cria um novo serviço de PLC com configuração personalizada
func NewPLCServiceWithConfig(
	pgPLCRepo domain.PLCRepository,
	pgTagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
	config PLCConfig,
) *PLCService {
	// Obter o cliente Redis do cache
	redisClient := cache.GetRedisClient()
	if redisClient == nil {
		log.Println("AVISO: Redis client não disponível, alguns recursos podem ficar limitados")
	}

	// Criar repositórios Redis
	var redisPLCRepo domain.PLCRepository
	var redisTagRepo domain.PLCTagRepository

	if redisClient != nil {
		redisPLCRepo = repository.NewPLCRedisRepository(redisClient)
		redisTagRepo = repository.NewPLCTagRedisRepository(redisClient)
	} else {
		// Se Redis não está disponível, usar repositórios mock que sempre delegam ao PostgreSQL
		redisPLCRepo = pgPLCRepo
		redisTagRepo = pgTagRepo
	}

	// Inicializar serviço
	s := &PLCService{
		pgPLCRepo:    pgPLCRepo,
		pgTagRepo:    pgTagRepo,
		redisPLCRepo: redisPLCRepo,
		redisTagRepo: redisTagRepo,
		cache:        cache,
		isRunning:    false,
		config:       config,
		addressMap: make(map[string]map[string]struct {
			DBNumber   int
			ByteOffset int
			BitOffset  int
			DataType   string
		}),
	}

	// Inicializar mapeamento de endereços conhecido
	s.initAddressMap()

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

// initAddressMap inicializa o mapeamento de endereços para referência
func (s *PLCService) initAddressMap() {
	// DB11 - mapeamentos conhecidos
	db11Map := make(map[string]struct {
		DBNumber   int
		ByteOffset int
		BitOffset  int
		DataType   string
	})

	// Mapeamento de bits
	for i := 0; i <= 7; i++ {
		bitName := fmt.Sprintf("bit_%d", i)
		if i == 0 {
			bitName = "bit" // caso especial para o primeiro
		}

		db11Map[bitName] = struct {
			DBNumber   int
			ByteOffset int
			BitOffset  int
			DataType   string
		}{
			DBNumber:   11,
			ByteOffset: 0,
			BitOffset:  i,
			DataType:   "bool",
		}
	}

	// Bits adicionais em outra posição
	db11Map["bit_8"] = struct {
		DBNumber   int
		ByteOffset int
		BitOffset  int
		DataType   string
	}{
		DBNumber:   11,
		ByteOffset: 1,
		BitOffset:  0,
		DataType:   "bool",
	}

	db11Map["bit_9"] = struct {
		DBNumber   int
		ByteOffset int
		BitOffset  int
		DataType   string
	}{
		DBNumber:   11,
		ByteOffset: 1,
		BitOffset:  1,
		DataType:   "bool",
	}

	// Valores inteiros
	intPositions := map[string]int{
		"int":   2,
		"int_1": 4,
		"int_2": 6,
		"int_3": 8,
		"int_4": 10,
		"int_5": 12,
	}

	for name, pos := range intPositions {
		db11Map[name] = struct {
			DBNumber   int
			ByteOffset int
			BitOffset  int
			DataType   string
		}{
			DBNumber:   11,
			ByteOffset: pos,
			BitOffset:  0,
			DataType:   "int",
		}
	}

	// Adicionar o mapa de DB11 ao mapa principal
	s.addressMap["DB11"] = db11Map
}

// GetPLCAddressMap retorna o mapeamento de endereços para um DB específico
func (s *PLCService) GetPLCAddressMap(dbName string) (map[string]struct {
	DBNumber   int
	ByteOffset int
	BitOffset  int
	DataType   string
}, bool) {
	dbMap, exists := s.addressMap[dbName]
	return dbMap, exists
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
		if errors.Is(err, domain.ErrPLCNotFound) {
			return domain.PLC{}, fmt.Errorf("PLC com ID %d não encontrado: %w", id, domain.ErrPLCNotFound)
		}
		return domain.PLC{}, fmt.Errorf("erro ao buscar PLC com ID %d: %w", id, err)
	}

	// Armazenar no Redis para acessos futuros se o cache estiver ativado
	if s.config.CacheEnabled {
		_, storeErr := s.redisPLCRepo.Create(plc)
		if storeErr != nil {
			log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", id, storeErr)
		}
	}

	return plc, nil
}

// GetAll retorna todos os PLCs
func (s *PLCService) GetAll() ([]domain.PLC, error) {
	// Tentar Redis primeiro se o cache estiver ativado
	if s.config.CacheEnabled {
		plcs, err := s.redisPLCRepo.GetAll()
		if err == nil && len(plcs) > 0 {
			return plcs, nil
		}
	}

	// Se não houver dados no Redis ou cache desativado, buscar do PostgreSQL
	plcs, err := s.pgPLCRepo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs: %w", err)
	}

	// Armazenar no Redis para futuras consultas se o cache estiver ativado
	if s.config.CacheEnabled {
		for _, plc := range plcs {
			_, err := s.redisPLCRepo.Create(plc)
			if err != nil {
				log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", plc.ID, err)
			}
		}
	}

	return plcs, nil
}

// GetActivePLCs retorna PLCs ativos
func (s *PLCService) GetActivePLCs() ([]domain.PLC, error) {
	// Tentar Redis primeiro se o cache estiver ativado
	if s.config.CacheEnabled {
		plcs, err := s.redisPLCRepo.GetActivePLCs()
		if err == nil && len(plcs) > 0 {
			return plcs, nil
		}
	}

	// Se não houver dados no Redis ou cache desativado, buscar do PostgreSQL
	plcs, err := s.pgPLCRepo.GetActivePLCs()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs ativos: %w", err)
	}

	// Armazenar no Redis para futuras consultas se o cache estiver ativado
	if s.config.CacheEnabled {
		for _, plc := range plcs {
			_, err := s.redisPLCRepo.Create(plc)
			if err != nil {
				log.Printf("Aviso: erro ao armazenar PLC %d no Redis: %v", plc.ID, err)
			}
		}
	}

	return plcs, nil
}

// Create cria um novo PLC
func (s *PLCService) Create(plc domain.PLC) (int, error) {
	// Validações
	if plc.Name == "" {
		return 0, ErrInvalidPLCName
	}

	if plc.IPAddress == "" {
		return 0, ErrInvalidIPAddress
	}

	// Definir data de criação
	plc.CreatedAt = time.Now()

	// Criar no banco de dados principal (persistência)
	id, err := s.pgPLCRepo.Create(plc)
	if err != nil {
		return 0, fmt.Errorf("erro ao criar PLC no banco de dados: %w", err)
	}

	// Definir ID retornado
	plc.ID = id

	// Criar no Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		_, err = s.redisPLCRepo.Create(plc)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar novo PLC no Redis: %v", err)
		}
	}

	// Notificar o serviço de sincronização
	if s.syncService != nil && s.syncService.IsRunning() {
		s.syncService.NotifyPLCChange(id)
	}

	return id, nil
}

// Update atualiza um PLC
func (s *PLCService) Update(plc domain.PLC) error {
	// Validações
	if plc.Name == "" {
		return ErrInvalidPLCName
	}

	if plc.IPAddress == "" {
		return ErrInvalidIPAddress
	}

	// Atualizar data
	plc.UpdatedAt = time.Now()

	// Atualizar no banco de dados principal
	err := s.pgPLCRepo.Update(plc)
	if err != nil {
		if errors.Is(err, domain.ErrPLCNotFound) {
			return fmt.Errorf("PLC com ID %d não encontrado para atualização: %w", plc.ID, domain.ErrPLCNotFound)
		}
		return fmt.Errorf("erro ao atualizar PLC no banco de dados: %w", err)
	}

	// Atualizar no Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		err = s.redisPLCRepo.Update(plc)
		if err != nil {
			// Tentar criar caso não exista
			if errors.Is(err, domain.ErrPLCNotFound) {
				_, err = s.redisPLCRepo.Create(plc)
				if err != nil {
					log.Printf("Aviso: erro ao criar PLC no Redis após falha na atualização: %v", err)
				}
			} else {
				log.Printf("Aviso: erro ao atualizar PLC no Redis: %v", err)
			}
		}
	}

	// Notificar o serviço de sincronização
	if s.syncService != nil && s.syncService.IsRunning() {
		s.syncService.NotifyPLCChange(plc.ID)
	}

	// Se o monitoramento estiver ativo, solicitar reset de conexão
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if isRunning && s.manager != nil {
		// Verificar se a conexão existe primeiro
		conn, err := s.manager.GetConnectionByPLCID(plc.ID)
		if err == nil && conn != nil {
			log.Printf("Solicitando reconexão para o PLC %d após atualização", plc.ID)
			err := s.ResetPLCConnection(plc.ID)
			if err != nil {
				log.Printf("Aviso: não foi possível resetar a conexão do PLC %d: %v", plc.ID, err)
			}
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
			if err != nil && !errors.Is(err, domain.ErrPLCTagNotFound) {
				log.Printf("Aviso: erro ao excluir tag %d do PLC %d: %v", tag.ID, id, err)
			}
		}
	}

	// Se o monitoramento estiver ativo, parar a conexão primeiro
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if isRunning && s.manager != nil {
		// Verificar se a conexão existe
		conn, err := s.manager.GetConnectionByPLCID(id)
		if err == nil && conn != nil {
			log.Printf("Fechando conexão ativa com PLC %d antes da exclusão", id)
			conn.Close()
		}
	}

	// Excluir do banco de dados principal
	err = s.pgPLCRepo.Delete(id)
	if err != nil {
		if errors.Is(err, domain.ErrPLCNotFound) {
			return fmt.Errorf("PLC com ID %d não encontrado para exclusão: %w", id, domain.ErrPLCNotFound)
		}
		return fmt.Errorf("erro ao excluir PLC do banco de dados: %w", err)
	}

	// Excluir do Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		err = s.redisPLCRepo.Delete(id)
		if err != nil && !errors.Is(err, domain.ErrPLCNotFound) {
			log.Printf("Aviso: erro ao excluir PLC do Redis: %v", err)
		}
	}

	return nil
}

// GetPLCTags busca as tags de um PLC
func (s *PLCService) GetPLCTags(plcID int) ([]domain.PLCTag, error) {
	// Verificar se o PLC existe
	_, err := s.GetByID(plcID)
	if err != nil {
		return nil, fmt.Errorf("erro ao verificar PLC: %w", err)
	}

	// Tentar buscar do Redis primeiro se o cache estiver ativado
	var tags []domain.PLCTag

	if s.config.CacheEnabled {
		tags, err = s.redisTagRepo.GetPLCTags(plcID)
		if err == nil && len(tags) > 0 {
			// Carregar valores atuais das tags
			err = s.loadTagValues(plcID, tags)
			if err != nil {
				log.Printf("Aviso: erro ao carregar valores das tags: %v", err)
			}
			return tags, nil
		}
	}

	// Se não encontrar no Redis ou cache desativado, buscar do PostgreSQL
	tags, err = s.pgTagRepo.GetPLCTags(plcID)
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar tags do PLC %d: %w", plcID, err)
	}

	// Armazenar no Redis para futuras consultas se o cache estiver ativado
	if s.config.CacheEnabled {
		for _, tag := range tags {
			_, err := s.redisTagRepo.Create(tag)
			if err != nil {
				log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", tag.ID, err)
			}
		}
	}

	// Carregar valores atuais
	err = s.loadTagValues(plcID, tags)
	if err != nil {
		log.Printf("Aviso: erro ao carregar valores das tags: %v", err)
	}

	return tags, nil
}

// loadTagValues carrega os valores atuais de um conjunto de tags
func (s *PLCService) loadTagValues(plcID int, tags []domain.PLCTag) error {
	if len(tags) == 0 {
		return nil
	}

	// Preparar consulta batch
	queries := make([]struct{ PLCID, TagID int }, len(tags))
	for i, tag := range tags {
		queries[i] = struct{ PLCID, TagID int }{PLCID: plcID, TagID: tag.ID}
	}

	// Buscar valores em batch
	values, err := s.cache.GetMultipleTagValues(queries)
	if err != nil {
		return fmt.Errorf("erro ao buscar valores em batch: %w", err)
	}

	// Mapear valores por ID da tag
	valueMap := make(map[int]interface{})
	for _, value := range values {
		valueMap[value.TagID] = value.Value
	}

	// Atribuir valores às tags
	for i := range tags {
		if value, exists := valueMap[tags[i].ID]; exists {
			tags[i].CurrentValue = value
		} else {
			tags[i].CurrentValue = nil
		}
	}

	return nil
}

// GetTagByID busca uma tag pelo ID
func (s *PLCService) GetTagByID(id int) (domain.PLCTag, error) {
	// Tentar buscar do Redis primeiro se o cache estiver ativado
	var tag domain.PLCTag
	var err error

	if s.config.CacheEnabled {
		tag, err = s.redisTagRepo.GetByID(id)
		if err == nil {
			// Carregar valor atual
			tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
			if err == nil && tagValue != nil {
				tag.CurrentValue = tagValue.Value
			} else {
				tag.CurrentValue = nil
			}
			return tag, nil
		}
	}

	// Se não encontrar no Redis ou cache desativado, buscar do PostgreSQL
	tag, err = s.pgTagRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, domain.ErrPLCTagNotFound) {
			return domain.PLCTag{}, fmt.Errorf("tag com ID %d não encontrada: %w", id, domain.ErrPLCTagNotFound)
		}
		return domain.PLCTag{}, fmt.Errorf("erro ao buscar tag com ID %d: %w", id, err)
	}

	// Armazenar no Redis para futuras consultas se o cache estiver ativado
	if s.config.CacheEnabled {
		_, err = s.redisTagRepo.Create(tag)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", id, err)
		}
	}

	// Carregar valor atual
	tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
	if err == nil && tagValue != nil {
		tag.CurrentValue = tagValue.Value
	} else {
		tag.CurrentValue = nil
	}

	return tag, nil
}

// GetTagByName busca tags pelo nome
func (s *PLCService) GetTagByName(name string) ([]domain.PLCTag, error) {
	if name == "" {
		return nil, ErrInvalidTagName
	}

	// Tentar buscar do Redis primeiro se o cache estiver ativado
	var tags []domain.PLCTag
	var err error

	if s.config.CacheEnabled {
		tags, err = s.redisTagRepo.GetByName(name)
		if err == nil && len(tags) > 0 {
			// Carregar valores atuais
			for i := range tags {
				tagValue, err := s.cache.GetTagValue(tags[i].PLCID, tags[i].ID)
				if err == nil && tagValue != nil {
					tags[i].CurrentValue = tagValue.Value
				} else {
					tags[i].CurrentValue = nil
				}
			}
			return tags, nil
		}
	}

	// Se não encontrar no Redis ou cache desativado, buscar do PostgreSQL
	tags, err = s.pgTagRepo.GetByName(name)
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar tags com nome '%s': %w", name, err)
	}

	if len(tags) == 0 {
		return []domain.PLCTag{}, nil
	}

	// Armazenar no Redis para futuras consultas se o cache estiver ativado
	if s.config.CacheEnabled {
		for _, tag := range tags {
			_, err := s.redisTagRepo.Create(tag)
			if err != nil {
				log.Printf("Aviso: erro ao armazenar tag %d no Redis: %v", tag.ID, err)
			}
		}
	}

	// Carregar valores atuais
	for i := range tags {
		tagValue, err := s.cache.GetTagValue(tags[i].PLCID, tags[i].ID)
		if err == nil && tagValue != nil {
			tags[i].CurrentValue = tagValue.Value
		} else {
			tags[i].CurrentValue = nil
		}
	}

	return tags, nil
}

// isValidDataType verifica se um tipo de dados é válido
func (s *PLCService) isValidDataType(dataType string) bool {
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

	return validTypes[strings.ToLower(strings.TrimSpace(dataType))]
}

// CreateTag cria uma nova tag
func (s *PLCService) CreateTag(tag domain.PLCTag) (int, error) {
	// Validações
	if tag.Name == "" {
		return 0, ErrInvalidTagName
	}

	if tag.DataType == "" {
		return 0, ErrInvalidDataType
	}

	// Normalizar o tipo de dados para evitar problemas de case-sensitivity
	tag.DataType = strings.ToLower(strings.TrimSpace(tag.DataType))

	// Validar tipo de dados
	if !s.isValidDataType(tag.DataType) {
		return 0, fmt.Errorf("%w: '%s' não é suportado", ErrInvalidDataType, tag.DataType)
	}

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			return 0, ErrInvalidBitOffset
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0
	}

	// Verificar se o PLC existe
	plc, err := s.GetByID(tag.PLCID)
	if err != nil {
		return 0, fmt.Errorf("PLC não encontrado: %w", err)
	}

	// Verificar se o mapeamento de endereços conhecidos tem esta tag
	dbName := fmt.Sprintf("DB%d", tag.DBNumber)
	if dbMap, exists := s.addressMap[dbName]; exists {
		if tagMapping, exists := dbMap[tag.Name]; exists {
			// Corrigir automaticamente os endereços
			if tag.DBNumber != tagMapping.DBNumber ||
				tag.ByteOffset != tagMapping.ByteOffset ||
				tag.BitOffset != tagMapping.BitOffset ||
				tag.DataType != tagMapping.DataType {

				log.Printf("Corrigindo automaticamente endereços da tag '%s' para corresponder ao mapeamento conhecido", tag.Name)
				tag.DBNumber = tagMapping.DBNumber
				tag.ByteOffset = tagMapping.ByteOffset
				tag.BitOffset = tagMapping.BitOffset
				tag.DataType = tagMapping.DataType
			}
		}
	}

	// Definir valores padrão
	tag.CreatedAt = time.Now()
	if tag.ScanRate <= 0 {
		tag.ScanRate = s.config.DefaultTagScanRate
	}

	// Criar no banco de dados principal
	id, err := s.pgTagRepo.Create(tag)
	if err != nil {
		return 0, fmt.Errorf("erro ao criar tag no banco de dados: %w", err)
	}

	// Definir ID
	tag.ID = id

	// Criar no Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		_, err = s.redisTagRepo.Create(tag)
		if err != nil {
			log.Printf("Aviso: erro ao armazenar nova tag no Redis: %v", err)
		}
	}

	// Notificar o serviço de sincronização
	if s.syncService != nil && s.syncService.IsRunning() {
		s.syncService.NotifyTagChange(id)
		s.syncService.NotifyPLCChange(tag.PLCID)
	}

	// Log informativo
	log.Printf("Tag criada com sucesso - PLC: %s, ID: %d, Nome: %s, Tipo: %s, DB: %d, Byte: %d, Bit: %d",
		plc.Name, id, tag.Name, tag.DataType, tag.DBNumber, tag.ByteOffset, tag.BitOffset)

	return id, nil
}

// UpdateTag atualiza uma tag
func (s *PLCService) UpdateTag(tag domain.PLCTag) error {
	// Validações
	if tag.Name == "" {
		return ErrInvalidTagName
	}

	if tag.DataType == "" {
		return ErrInvalidDataType
	}

	// Normalizar o tipo de dados para evitar problemas de case-sensitivity
	tag.DataType = strings.ToLower(strings.TrimSpace(tag.DataType))

	// Validar tipo de dados
	if !s.isValidDataType(tag.DataType) {
		return fmt.Errorf("%w: '%s' não é suportado", ErrInvalidDataType, tag.DataType)
	}

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			return ErrInvalidBitOffset
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0
	}

	// Verificar se o PLC existe
	plc, err := s.GetByID(tag.PLCID)
	if err != nil {
		return fmt.Errorf("PLC não encontrado: %w", err)
	}

	// Obter tag antiga para comparação
	oldTag, err := s.GetTagByID(tag.ID)
	if err != nil {
		return fmt.Errorf("tag não encontrada: %w", err)
	}

	// Verificar se o mapeamento de endereços conhecidos tem esta tag
	dbName := fmt.Sprintf("DB%d", tag.DBNumber)
	if dbMap, exists := s.addressMap[dbName]; exists {
		if tagMapping, exists := dbMap[tag.Name]; exists {
			// Corrigir automaticamente os endereços
			if tag.DBNumber != tagMapping.DBNumber ||
				tag.ByteOffset != tagMapping.ByteOffset ||
				tag.BitOffset != tagMapping.BitOffset ||
				tag.DataType != tagMapping.DataType {

				log.Printf("Corrigindo automaticamente endereços da tag '%s' para corresponder ao mapeamento conhecido", tag.Name)
				tag.DBNumber = tagMapping.DBNumber
				tag.ByteOffset = tagMapping.ByteOffset
				tag.BitOffset = tagMapping.BitOffset
				tag.DataType = tagMapping.DataType
			}
		}
	}

	// Atualizar data
	tag.UpdatedAt = time.Now()

	// Definir valores padrão
	if tag.ScanRate <= 0 {
		tag.ScanRate = s.config.DefaultTagScanRate
	}

	// Atualizar no banco de dados principal
	err = s.pgTagRepo.Update(tag)
	if err != nil {
		if errors.Is(err, domain.ErrPLCTagNotFound) {
			return fmt.Errorf("tag com ID %d não encontrada para atualização: %w", tag.ID, domain.ErrPLCTagNotFound)
		}
		return fmt.Errorf("erro ao atualizar tag no banco de dados: %w", err)
	}

	// Atualizar no Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		err = s.redisTagRepo.Update(tag)
		if err != nil {
			// Tentar criar caso não exista
			if errors.Is(err, domain.ErrPLCTagNotFound) {
				_, err = s.redisTagRepo.Create(tag)
				if err != nil {
					log.Printf("Aviso: erro ao criar tag no Redis após falha na atualização: %v", err)
				}
			} else {
				log.Printf("Aviso: erro ao atualizar tag no Redis: %v", err)
			}
		}
	}

	// Notificar o serviço de sincronização
	if s.syncService != nil && s.syncService.IsRunning() {
		s.syncService.NotifyTagChange(tag.ID)
		s.syncService.NotifyPLCChange(tag.PLCID)
	}

	// Log informativo detalhado
	if oldTag.DBNumber != tag.DBNumber ||
		oldTag.ByteOffset != tag.ByteOffset ||
		oldTag.BitOffset != tag.BitOffset ||
		oldTag.DataType != tag.DataType {

		log.Printf("Tag %d atualizada com novos endereços - PLC: %s, Nome: %s, Antigo: DB%d.DBX%d.%d (%s), Novo: DB%d.DBX%d.%d (%s)",
			tag.ID, plc.Name, tag.Name,
			oldTag.DBNumber, oldTag.ByteOffset, oldTag.BitOffset, oldTag.DataType,
			tag.DBNumber, tag.ByteOffset, tag.BitOffset, tag.DataType)
	} else {
		log.Printf("Tag %d atualizada sem mudanças de endereço - PLC: %s, Nome: %s",
			tag.ID, plc.Name, tag.Name)
	}

	return nil
}

// DeleteTag remove uma tag
func (s *PLCService) DeleteTag(id int) error {
	// Buscar tag antes de excluir apenas para verificar se existe
	tag, err := s.GetTagByID(id)
	if err != nil {
		if errors.Is(err, domain.ErrPLCTagNotFound) {
			// Já não existe, considerar operação bem-sucedida
			return nil
		}
		return fmt.Errorf("erro ao verificar existência da tag: %w", err)
	}

	plcID := tag.PLCID

	// Excluir do banco de dados principal
	err = s.pgTagRepo.Delete(id)
	if err != nil {
		if errors.Is(err, domain.ErrPLCTagNotFound) {
			// Já não existe, considerar operação bem-sucedida
			return nil
		}
		return fmt.Errorf("erro ao excluir tag do banco de dados: %w", err)
	}

	// Excluir do Redis também se o cache estiver ativado
	if s.config.CacheEnabled {
		err = s.redisTagRepo.Delete(id)
		if err != nil && !errors.Is(err, domain.ErrPLCTagNotFound) {
			log.Printf("Aviso: erro ao excluir tag do Redis: %v", err)
		}
	}

	// Notificar o serviço de sincronização
	if s.syncService != nil && s.syncService.IsRunning() {
		s.syncService.NotifyPLCChange(plcID)
	}

	log.Printf("Tag %d (%s) excluída com sucesso", id, tag.Name)
	return nil
}

// StartMonitoring inicia o monitoramento de PLCs
func (s *PLCService) StartMonitoring() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("monitoramento já está em execução")
	}

	// Verificar se o monitoramento está habilitado na configuração
	if !s.config.MonitoringEnabled {
		return fmt.Errorf("monitoramento está desabilitado na configuração")
	}

	// Iniciar serviço de sincronização
	if s.syncService != nil {
		err := s.syncService.Start()
		if err != nil {
			return fmt.Errorf("erro ao iniciar sincronização: %w", err)
		}
	}

	// Iniciar gerenciador de PLCs
	if s.manager != nil {
		// Configurar logging detalhado
		s.manager.SetDetailedLogging(s.config.DetailedLoggingEnabled)

		err := s.manager.Start()
		if err != nil {
			// Se houver erro, parar o serviço de sincronização já iniciado
			if s.syncService != nil {
				s.syncService.Stop()
			}
			return fmt.Errorf("erro ao iniciar gerenciador de PLCs: %w", err)
		}
	} else {
		// Se synchronization iniciou bem mas o gerenciador é nulo, ainda assim parar
		if s.syncService != nil {
			s.syncService.Stop()
		}
		return fmt.Errorf("gerenciador de PLCs não inicializado")
	}

	s.isRunning = true
	log.Println("Serviço de monitoramento de PLCs iniciado")
	return nil
}

// StopMonitoring para o monitoramento de PLCs
func (s *PLCService) StopMonitoring() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return nil // Já está parado
	}

	var errs []error

	// Parar gerenciador
	if s.manager != nil {
		s.manager.Stop()
	}

	// Parar sincronização
	if s.syncService != nil {
		err := s.syncService.Stop()
		if err != nil {
			errs = append(errs, fmt.Errorf("erro ao parar serviço de sincronização: %w", err))
		}
	}

	s.isRunning = false
	log.Println("Serviço de monitoramento de PLCs parado")

	// Se tivemos erros, retornar o primeiro
	if len(errs) > 0 {
		return errs[0]
	}

	return nil
}

// WriteTagValue escreve um valor em uma tag pelo nome
func (s *PLCService) WriteTagValue(tagName string, value interface{}) error {
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if !isRunning || s.manager == nil {
		return ErrMonitoringNotActive
	}

	// Verificar valor nulo
	if value == nil {
		return fmt.Errorf("valor não pode ser nulo")
	}

	// Usar o manager para escrever o valor
	return s.manager.WriteTagByName(tagName, value)
}

// GetTagValue busca o valor atual de uma tag
func (s *PLCService) GetTagValue(plcID int, tagID int) (*domain.TagValue, error) {
	// Verificar se a tag existe
	tag, err := s.GetTagByID(tagID)
	if err != nil {
		return nil, fmt.Errorf("erro ao verificar existência da tag: %w", err)
	}

	// Verificar se o plcID corresponde
	if tag.PLCID != plcID {
		return nil, fmt.Errorf("tag %d não pertence ao PLC %d", tagID, plcID)
	}

	// Buscar o valor do cache
	return s.cache.GetTagValue(plcID, tagID)
}

// GetPLCStats retorna estatísticas do gerenciador de PLCs
func (s *PLCService) GetPLCStats() domain.PLCManagerStats {
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if !isRunning || s.manager == nil {
		// Retornar estatísticas vazias
		return domain.PLCManagerStats{
			ConnectionStats: make(map[int]domain.PLCConnectionStats),
			LastUpdated:     time.Now(),
		}
	}

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
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	// Verificar se o monitoramento está rodando
	if !isRunning {
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
				// Verificar se o serviço ainda está em execução
				s.mu.RLock()
				stillRunning := s.isRunning
				s.mu.RUnlock()

				if !stillRunning {
					log.Println("DEPURAÇÃO: Monitor de depuração interrompido devido à parada do serviço")
					return
				}

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

					// Filtrar apenas tags ativas
					activeTags := make([]domain.PLCTag, 0)
					for _, tag := range tags {
						if tag.Active {
							activeTags = append(activeTags, tag)
						}
					}

					if len(activeTags) == 0 {
						log.Printf("DEPURAÇÃO: PLC %s (ID=%d) não tem tags ativas", plc.Name, plc.ID)
						continue
					}

					// Imprimir cabeçalho
					log.Printf("=== VALORES ATUAIS DO PLC %s (STATUS: %s) ===", plc.Name, plc.Status)

					// Imprimir cada tag com seu valor
					for _, tag := range activeTags {
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
		return fmt.Errorf("erro ao buscar PLCs: %w", err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	totalCorrected := 0
	errorCount := 0

	for _, plc := range plcs {
		wg.Add(1)
		go func(plc domain.PLC) {
			defer wg.Done()
			log.Printf("Verificando tags do PLC %s (ID=%d)", plc.Name, plc.ID)

			// Obter tags do PLC
			tags, err := s.GetPLCTags(plc.ID)
			if err != nil {
				mu.Lock()
				errorCount++
				mu.Unlock()
				log.Printf("Erro ao buscar tags do PLC %d: %v", plc.ID, err)
				return
			}

			localCorrected := 0

			// Verificar cada tag
			for _, tag := range tags {
				// Verificar endereços conforme mapeamento conhecido
				dbName := fmt.Sprintf("DB%d", tag.DBNumber)
				if dbMap, exists := s.addressMap[dbName]; exists {
					if tagMapping, exists := dbMap[tag.Name]; exists {
						needsUpdate := false

						if tag.DBNumber != tagMapping.DBNumber ||
							tag.ByteOffset != tagMapping.ByteOffset ||
							tag.BitOffset != tagMapping.BitOffset ||
							tag.DataType != tagMapping.DataType {

							// Backup dos valores originais para log
							oldDB := tag.DBNumber
							oldByte := tag.ByteOffset
							oldBit := tag.BitOffset
							oldType := tag.DataType

							// Atualizar com valores corretos
							tag.DBNumber = tagMapping.DBNumber
							tag.ByteOffset = tagMapping.ByteOffset
							tag.BitOffset = tagMapping.BitOffset
							tag.DataType = tagMapping.DataType
							needsUpdate = true

							log.Printf("Corrigindo endereço da tag '%s': DB%d.DBX%d.%d (%s) -> DB%d.DBX%d.%d (%s)",
								tag.Name,
								oldDB, oldByte, oldBit, oldType,
								tag.DBNumber, tag.ByteOffset, tag.BitOffset, tag.DataType)
						}

						// Se precisar atualizar, chama o método UpdateTag
						if needsUpdate {
							if err := s.UpdateTag(tag); err != nil {
								mu.Lock()
								errorCount++
								mu.Unlock()
								log.Printf("Erro ao atualizar tag %s (ID=%d): %v", tag.Name, tag.ID, err)
							} else {
								mu.Lock()
								totalCorrected++
								localCorrected++
								mu.Unlock()
							}
						}
					}
				}
			}

			if localCorrected > 0 {
				log.Printf("PLC %s: %d tags corrigidas com sucesso", plc.Name, localCorrected)
			} else {
				log.Printf("PLC %s: nenhuma correção de tag necessária", plc.Name)
			}
		}(plc)
	}

	// Aguardar todas as goroutines
	wg.Wait()

	log.Printf("Verificação e correção de endereços concluída: %d tags corrigidas, %d erros",
		totalCorrected, errorCount)

	if errorCount > 0 {
		return fmt.Errorf("verificação de endereços concluída com %d erros", errorCount)
	}

	return nil
}

// CheckPLCHealth verifica a saúde das conexões com PLCs
func (s *PLCService) CheckPLCHealth() (map[int]string, error) {
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if !isRunning || s.manager == nil {
		return nil, ErrMonitoringNotActive
	}

	health := make(map[int]string)

	// Obter todos os PLCs ativos
	plcs, err := s.GetActivePLCs()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs ativos: %w", err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, plc := range plcs {
		wg.Add(1)
		go func(plc domain.PLC) {
			defer wg.Done()

			// Tentar recuperar a conexão através do gerenciador
			conn, err := s.manager.GetConnectionByPLCID(plc.ID)
			if err != nil {
				mu.Lock()
				health[plc.ID] = fmt.Sprintf("offline: %v", err)
				mu.Unlock()
				return
			}

			// Verificar a conexão com ping
			if err := conn.Ping(); err != nil {
				mu.Lock()
				health[plc.ID] = fmt.Sprintf("falha: %v", err)
				mu.Unlock()
			} else {
				mu.Lock()
				health[plc.ID] = "online"
				mu.Unlock()
			}
		}(plc)
	}

	wg.Wait()
	return health, nil
}

// ResetPLCConnection força a reconexão com um PLC específico
func (s *PLCService) ResetPLCConnection(plcID int) error {
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if !isRunning || s.manager == nil {
		return ErrMonitoringNotActive
	}

	// Verificar se o PLC existe
	plc, err := s.GetByID(plcID)
	if err != nil {
		return fmt.Errorf("erro ao verificar PLC: %w", err)
	}

	if !plc.Active {
		return ErrPLCNotActive
	}

	log.Printf("Solicitada reconexão com PLC %s (ID=%d)", plc.Name, plc.ID)

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

	// Sincronizar no Redis também
	if s.syncService != nil && s.syncService.IsRunning() {
		err = s.syncService.SyncSpecificPLC(plcID)
		if err != nil {
			log.Printf("Erro ao sincronizar PLC %d com Redis após reconexão: %v", plcID, err)
		}
	}

	return nil
}

// GetStatistics retorna estatísticas mais detalhadas do sistema
func (s *PLCService) GetStatistics() map[string]interface{} {
	stats := make(map[string]interface{})

	// Estatísticas do gerenciador
	s.mu.RLock()
	isRunning := s.isRunning
	s.mu.RUnlock()

	if isRunning && s.manager != nil {
		managerStats := s.manager.GetStats()
		stats["manager"] = managerStats
	} else {
		stats["manager"] = "serviço não está ativo"
	}

	// Obter serviço de sincronização
	if s.syncService != nil {
		stats["sync_service"] = map[string]interface{}{
			"running": s.syncService.IsRunning(),
		}
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

		// Contar PLCs ativos
		activePlcs := 0
		for _, plc := range plcs {
			if plc.Active {
				activePlcs++
			}
		}
		stats["active_plcs"] = activePlcs
	} else {
		stats["plc_error"] = fmt.Sprintf("erro ao buscar PLCs: %v", err)
	}

	// Contar total de tags
	totalTags := 0
	activeTags := 0
	tagsPerPLC := make(map[int]int)
	tagsPerDataType := make(map[string]int)

	for _, plc := range plcs {
		tags, err := s.GetPLCTags(plc.ID)
		if err == nil {
			tagsPerPLC[plc.ID] = len(tags)
			totalTags += len(tags)

			for _, tag := range tags {
				if tag.Active {
					activeTags++
				}

				dataType := strings.ToLower(tag.DataType)
				tagsPerDataType[dataType] = tagsPerDataType[dataType] + 1
			}
		}
	}

	stats["total_tags"] = totalTags
	stats["active_tags"] = activeTags
	stats["tags_per_plc"] = tagsPerPLC
	stats["tags_per_type"] = tagsPerDataType

	// Adicionar timestamp
	stats["timestamp"] = time.Now().Format(time.RFC3339)

	return stats
}

// DiagnosticTags verifica a configuração de todas as tags e tenta corrigir inconsistências
func (s *PLCService) DiagnosticTags() (map[string]interface{}, error) {
	results := make(map[string]interface{})
	var fixedTags, errorTags int

	// Obter todos os PLCs
	plcs, err := s.GetAll()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar PLCs: %w", err)
	}

	plcResults := make(map[int]map[string]interface{})
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, plc := range plcs {
		wg.Add(1)
		go func(plc domain.PLC) {
			defer wg.Done()

			plcResult := make(map[string]interface{})
			plcResult["name"] = plc.Name
			plcResult["status"] = plc.Status
			plcResult["active"] = plc.Active

			// Buscar todas as tags do PLC
			tags, err := s.GetPLCTags(plc.ID)
			if err != nil {
				mu.Lock()
				plcResult["error"] = fmt.Sprintf("erro ao buscar tags: %v", err)
				plcResults[plc.ID] = plcResult
				errorTags++
				mu.Unlock()
				return
			}

			tagIssues := make([]map[string]interface{}, 0)
			localFixed := 0
			localErrors := 0

			for _, tag := range tags {
				// Criar cópia da tag para modificações
				tagCopy := tag

				// Verificar problemas com a tag
				needsFix := false
				issue := map[string]interface{}{
					"tag_id":   tag.ID,
					"tag_name": tag.Name,
				}

				// Problema 1: Tipo de dados ausente ou inválido
				if tag.DataType == "" {
					issue["issue"] = "Tipo de dados ausente"
					issue["action"] = "Definido como 'word'"
					tagCopy.DataType = "word"
					needsFix = true
				} else if !s.isValidDataType(tag.DataType) {
					issue["issue"] = fmt.Sprintf("Tipo de dados inválido: '%s'", tag.DataType)
					issue["action"] = "Definido como 'word'"
					tagCopy.DataType = "word"
					needsFix = true
				}

				// Problema 2: Bit offset inválido para tipo bool
				if tagCopy.DataType == "bool" && (tag.BitOffset < 0 || tag.BitOffset > 7) {
					issue["issue"] = fmt.Sprintf("Bit offset inválido (%d) para tipo bool", tag.BitOffset)
					issue["action"] = "Corrigido para valor entre 0 e 7"

					// Corrigir bit offset
					if tag.BitOffset < 0 {
						tagCopy.BitOffset = 0
					} else {
						tagCopy.BitOffset = tag.BitOffset % 8
					}

					needsFix = true
				}

				// Problema 3: Bit offset não-zero para tipo não-booleano
				if tagCopy.DataType != "bool" && tag.BitOffset != 0 {
					issue["issue"] = fmt.Sprintf("Bit offset (%d) definido para tipo não booleano (%s)",
						tag.BitOffset, tag.DataType)
					issue["action"] = "Bit offset definido como 0"

					// Corrigir bit offset
					tagCopy.BitOffset = 0
					needsFix = true
				}

				// Problema 4: Verificar mapeamento conhecido
				dbName := fmt.Sprintf("DB%d", tag.DBNumber)
				if dbMap, exists := s.addressMap[dbName]; exists {
					if tagMapping, exists := dbMap[tag.Name]; exists {
						if tag.DBNumber != tagMapping.DBNumber ||
							tag.ByteOffset != tagMapping.ByteOffset ||
							tag.BitOffset != tagMapping.BitOffset ||
							tag.DataType != tagMapping.DataType {

							issue["issue"] = fmt.Sprintf("Endereço não corresponde ao mapeamento conhecido: DB%d.DBX%d.%d (%s)",
								tag.DBNumber, tag.ByteOffset, tag.BitOffset, tag.DataType)
							issue["action"] = fmt.Sprintf("Corrigido para DB%d.DBX%d.%d (%s)",
								tagMapping.DBNumber, tagMapping.ByteOffset, tagMapping.BitOffset, tagMapping.DataType)

							tagCopy.DBNumber = tagMapping.DBNumber
							tagCopy.ByteOffset = tagMapping.ByteOffset
							tagCopy.BitOffset = tagMapping.BitOffset
							tagCopy.DataType = tagMapping.DataType
							needsFix = true
						}
					}
				}

				// Se precisa de correção, aplicar
				if needsFix {
					if err := s.UpdateTag(tagCopy); err != nil {
						issue["result"] = fmt.Sprintf("Erro ao corrigir: %v", err)
						mu.Lock()
						errorTags++
						localErrors++
						mu.Unlock()
					} else {
						issue["result"] = "Corrigido com sucesso"
						mu.Lock()
						fixedTags++
						localFixed++
						mu.Unlock()
					}

					tagIssues = append(tagIssues, issue)
				}
			}

			mu.Lock()
			plcResult["tags_count"] = len(tags)
			plcResult["issues"] = tagIssues
			plcResult["fixed_count"] = localFixed
			plcResult["error_count"] = localErrors
			plcResults[plc.ID] = plcResult
			mu.Unlock()
		}(plc)
	}

	// Aguardar todas as goroutines
	wg.Wait()

	results["plcs"] = plcResults
	results["fixed_tags"] = fixedTags
	results["error_tags"] = errorTags
	results["timestamp"] = time.Now().Format(time.RFC3339)

	return results, nil
}
