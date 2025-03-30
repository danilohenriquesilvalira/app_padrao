package service

import (
	"app_padrao/internal/domain"
	"app_padrao/pkg/plc"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// PLCManager encapsula a lógica de gerenciamento dos PLCs
type PLCManager struct {
	// Repositórios Redis para acesso rápido
	plcRepo domain.PLCRepository
	tagRepo domain.PLCTagRepository
	cache   domain.PLCCache

	// Controle de execução
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Mapa de conexões ativas com PLCs
	activeConnections map[int]*PLCConnection
	connectionsMutex  sync.RWMutex

	// Estatísticas
	stats         PLCManagerStats
	statsInterval time.Duration
	statsMutex    sync.RWMutex

	// Configuração de logging
	enableDetailedLogging bool
}

// PLCManagerStats contém estatísticas do gerenciador de PLCs
type PLCManagerStats struct {
	ActivePLCs      int
	TotalTags       int
	TagsRead        int64
	TagsWritten     int64
	ReadErrors      int64
	WriteErrors     int64
	LastUpdated     time.Time
	ConnectionStats map[int]PLCConnectionStats
}

// PLCConnectionStats contém estatísticas de uma conexão com PLC
type PLCConnectionStats struct {
	PLCID         int
	Name          string
	Status        string
	TagCount      int
	LastConnected time.Time
	ReadErrors    int64
	WriteErrors   int64
}

// NewPLCManager cria um novo gerenciador de PLCs
func NewPLCManager(
	plcRepo domain.PLCRepository,
	tagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
) *PLCManager {
	return &PLCManager{
		plcRepo:           plcRepo,
		tagRepo:           tagRepo,
		cache:             cache,
		activeConnections: make(map[int]*PLCConnection),
		statsInterval:     time.Minute,
		stats: PLCManagerStats{
			ConnectionStats: make(map[int]PLCConnectionStats),
			LastUpdated:     time.Now(),
		},
		enableDetailedLogging: true, // Ativar logging detalhado por padrão
	}
}

// Start inicia o monitoramento dos PLCs
func (m *PLCManager) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	m.ctx = ctx
	m.cancel = cancel

	// Iniciar rotina de estatísticas
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		m.runStatsCollector(ctx)
	}()

	// Iniciar monitoramento de PLCs
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		m.runAllPLCs(ctx)
	}()

	log.Println("Gerenciador de PLCs iniciado")
	return nil
}

// Stop para o monitoramento dos PLCs
func (m *PLCManager) Stop() {
	if m.cancel != nil {
		m.cancel()
	}

	// Aguardar goroutines encerrarem
	m.wg.Wait()

	// Fechar todas as conexões ativas
	m.connectionsMutex.Lock()
	for id, conn := range m.activeConnections {
		conn.Close()
		log.Printf("Conexão com PLC %d fechada durante shutdown", id)
	}
	m.activeConnections = make(map[int]*PLCConnection)
	m.connectionsMutex.Unlock()

	log.Println("Gerenciador de PLCs encerrado")
}

// SetDetailedLogging ativa ou desativa o logging detalhado
func (m *PLCManager) SetDetailedLogging(enabled bool) {
	m.enableDetailedLogging = enabled
	log.Printf("Logging detalhado %s", map[bool]string{true: "ativado", false: "desativado"}[enabled])
}

// GetStats retorna as estatísticas atuais
func (m *PLCManager) GetStats() PLCManagerStats {
	m.statsMutex.RLock()
	defer m.statsMutex.RUnlock()

	// Retornar uma cópia para evitar race conditions
	stats := m.stats
	stats.ConnectionStats = make(map[int]PLCConnectionStats, len(m.stats.ConnectionStats))
	for id, connStats := range m.stats.ConnectionStats {
		stats.ConnectionStats[id] = connStats
	}

	return stats
}

// runStatsCollector atualiza as estatísticas periodicamente
func (m *PLCManager) runStatsCollector(ctx context.Context) {
	ticker := time.NewTicker(m.statsInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			m.updateStats()
		}
	}
}

// updateStats atualiza as estatísticas do gerenciador
func (m *PLCManager) updateStats() {
	// Obter PLCs ativos
	plcs, err := m.plcRepo.GetActivePLCs()
	if err != nil {
		log.Printf("Erro ao buscar PLCs ativos para estatísticas: %v", err)
		return
	}

	m.statsMutex.Lock()
	defer m.statsMutex.Unlock()

	m.stats.ActivePLCs = len(plcs)
	m.stats.TotalTags = 0
	m.stats.LastUpdated = time.Now()

	// Dados de conexão
	m.connectionsMutex.RLock()
	activeConnections := make(map[int]struct{}, len(m.activeConnections))
	for id := range m.activeConnections {
		activeConnections[id] = struct{}{}
	}
	m.connectionsMutex.RUnlock()

	// Atualizar estatísticas por PLC
	for _, plc := range plcs {
		// Contar tags para este PLC
		tags, err := m.tagRepo.GetPLCTags(plc.ID)
		tagCount := 0
		if err == nil {
			tagCount = len(tags)
			m.stats.TotalTags += tagCount
		}

		// Verificar se está conectado
		_, isConnected := activeConnections[plc.ID]
		status := "offline"
		if isConnected {
			status = "online"
		}

		// Atualizar ou criar estatísticas para este PLC
		if stats, exists := m.stats.ConnectionStats[plc.ID]; exists {
			stats.Name = plc.Name
			stats.Status = status
			stats.TagCount = tagCount
			m.stats.ConnectionStats[plc.ID] = stats
		} else {
			m.stats.ConnectionStats[plc.ID] = PLCConnectionStats{
				PLCID:         plc.ID,
				Name:          plc.Name,
				Status:        status,
				TagCount:      tagCount,
				LastConnected: time.Now(),
			}
		}
	}

	// Remover PLCs que não estão mais ativos
	activePLCIDs := make(map[int]struct{}, len(plcs))
	for _, plc := range plcs {
		activePLCIDs[plc.ID] = struct{}{}
	}

	for id := range m.stats.ConnectionStats {
		if _, exists := activePLCIDs[id]; !exists {
			delete(m.stats.ConnectionStats, id)
		}
	}
}

// isCriticalError verifica se o erro indica perda de conexão
func isCriticalError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "forçado") ||
		strings.Contains(lower, "cancelado") ||
		strings.Contains(lower, "connection") ||
		strings.Contains(lower, "timeout") ||
		strings.Contains(lower, "refused")
}

// PLCConnection é a implementação da conexão com o PLC
type PLCConnection struct {
	plcID    int
	ip       string
	rack     int
	slot     int
	s7Client *plc.Client // Cliente real S7
	active   bool
	mutex    sync.Mutex
	lastErr  error
}

// NewPLCConnection cria uma nova conexão com um PLC
func NewPLCConnection(plcID int, ip string, rack, slot int) *PLCConnection {
	return &PLCConnection{
		plcID:  plcID,
		ip:     ip,
		rack:   rack,
		slot:   slot,
		active: false,
	}
}

// Connect estabelece a conexão com o PLC
func (p *PLCConnection) Connect() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	// Fechar a conexão anterior se existir
	if p.s7Client != nil {
		p.s7Client.Close()
		p.s7Client = nil
	}

	log.Printf("Conectando ao PLC %d: %s (Rack: %d, Slot: %d)", p.plcID, p.ip, p.rack, p.slot)

	// Criar uma conexão real com o PLC usando o cliente S7
	client, err := plc.NewClient(p.ip, p.rack, p.slot)
	if err != nil {
		p.lastErr = err
		p.active = false
		return fmt.Errorf("falha ao conectar ao PLC: %v", err)
	}

	p.s7Client = client
	p.active = true
	log.Printf("Conectado ao PLC %d: %s", p.plcID, p.ip)
	return nil
}

// Ping verifica se o PLC está online
func (p *PLCConnection) Ping() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.s7Client == nil {
		return fmt.Errorf("conexão com PLC não inicializada")
	}

	// Usar o método Ping real do cliente S7
	return p.s7Client.Ping()
}

// Close fecha a conexão com o PLC
func (p *PLCConnection) Close() {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.s7Client != nil {
		p.s7Client.Close()
		p.s7Client = nil
	}
	p.active = false
	log.Printf("Conexão com PLC %d fechada", p.plcID)
}

// IsActive verifica se a conexão está ativa
func (p *PLCConnection) IsActive() bool {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	return p.active && p.s7Client != nil
}

// ReadTag lê uma tag do PLC - IMPLEMENTAÇÃO REAL
func (p *PLCConnection) ReadTag(dbNumber int, byteOffset int, dataType string, bitOffset int) (interface{}, error) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if !p.active || p.s7Client == nil {
		return nil, fmt.Errorf("conexão com PLC não está ativa")
	}

	// Chamar o método ReadTag do cliente S7 real que se conecta ao PLC físico
	return p.s7Client.ReadTag(dbNumber, byteOffset, dataType, bitOffset)
}

// WriteTag escreve uma tag no PLC - IMPLEMENTAÇÃO REAL
func (p *PLCConnection) WriteTag(dbNumber int, byteOffset int, dataType string, bitOffset int, value interface{}) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if !p.active || p.s7Client == nil {
		return fmt.Errorf("conexão com PLC não está ativa")
	}

	// Chamar o método WriteTag do cliente S7 real que se conecta ao PLC físico
	return p.s7Client.WriteTag(dbNumber, byteOffset, dataType, bitOffset, value)
}

// runAllPLCs consulta os PLCs ativos e inicia uma rotina para cada um
func (m *PLCManager) runAllPLCs(ctx context.Context) {
	if m.plcRepo == nil || m.tagRepo == nil || m.cache == nil {
		log.Printf("Erro crítico: repositórios ou cache nulos")
		return
	}

	// Mapa para controlar PLCs atualmente monitorados
	plcCancels := make(map[int]context.CancelFunc)

	// Verificar PLCs a cada 5 segundos
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	log.Println("Iniciando monitoramento de PLCs...")

	for {
		select {
		case <-ctx.Done():
			// Encerrar todos os monitoramentos
			for _, cancel := range plcCancels {
				cancel()
			}
			log.Println("Monitoramento de PLCs encerrado")
			return

		case <-ticker.C:
			// Buscar PLCs ativos do Redis
			plcs, err := m.plcRepo.GetActivePLCs()
			if err != nil {
				log.Printf("Erro ao carregar PLCs: %v", err)
				continue
			}

			// Remover PLCs inativos
			for plcID, cancel := range plcCancels {
				found := false
				for _, plc := range plcs {
					if plc.ID == plcID {
						found = true
						break
					}
				}

				if !found {
					cancel()
					delete(plcCancels, plcID)

					// Remover da lista de conexões ativas
					m.connectionsMutex.Lock()
					if conn, exists := m.activeConnections[plcID]; exists {
						conn.Close()
						delete(m.activeConnections, plcID)
					}
					m.connectionsMutex.Unlock()

					log.Printf("PLC ID %d removido do monitoramento", plcID)
				}
			}

			// Adicionar ou atualizar PLCs
			for _, plcConfig := range plcs {
				if plcConfig.IPAddress == "" {
					log.Printf("PLC ID %d tem endereço IP vazio", plcConfig.ID)
					continue
				}

				// Verificar se já estamos monitorando este PLC
				if _, exists := plcCancels[plcConfig.ID]; !exists {
					// Iniciar novo monitoramento
					plcCtx, cancel := context.WithCancel(ctx)
					plcCancels[plcConfig.ID] = cancel

					// Iniciar goroutine para este PLC
					m.wg.Add(1)
					go func(ctx context.Context, config domain.PLC) {
						defer m.wg.Done()
						m.monitorPLC(ctx, config)
					}(plcCtx, plcConfig)

					log.Printf("Iniciado monitoramento do PLC %d: %s", plcConfig.ID, plcConfig.Name)
				}
			}
		}
	}
}

// monitorPLC implementa o monitoramento de um PLC específico
func (m *PLCManager) monitorPLC(ctx context.Context, plcConfig domain.PLC) {
	log.Printf("Iniciando monitor para PLC %d: %s (%s)", plcConfig.ID, plcConfig.Name, plcConfig.IPAddress)

	// Criar conexão com o PLC
	conn := NewPLCConnection(plcConfig.ID, plcConfig.IPAddress, plcConfig.Rack, plcConfig.Slot)

	// Conectar ao PLC
	if err := conn.Connect(); err != nil {
		log.Printf("Erro ao conectar ao PLC %d: %v", plcConfig.ID, err)

		// Atualizar status do PLC para "offline"
		err := m.plcRepo.UpdatePLCStatus(domain.PLCStatus{
			PLCID:      plcConfig.ID,
			Status:     "offline",
			LastUpdate: time.Now(),
		})
		if err != nil {
			log.Printf("Erro ao atualizar status do PLC %d: %v", plcConfig.ID, err)
		}

		// Tentar novamente após 10 segundos
		time.Sleep(10 * time.Second)
		return
	}

	// Registrar a conexão ativa
	m.connectionsMutex.Lock()
	m.activeConnections[plcConfig.ID] = conn
	m.connectionsMutex.Unlock()

	// Atualizar status do PLC para "online"
	err := m.plcRepo.UpdatePLCStatus(domain.PLCStatus{
		PLCID:      plcConfig.ID,
		Status:     "online",
		LastUpdate: time.Now(),
	})
	if err != nil {
		log.Printf("Erro ao atualizar status do PLC %d: %v", plcConfig.ID, err)
	}

	// Monitorar as tags
	m.monitorPLCTags(ctx, plcConfig, conn)

	// Ao finalizar, fechar a conexão e remover do registro
	conn.Close()

	m.connectionsMutex.Lock()
	delete(m.activeConnections, plcConfig.ID)
	m.connectionsMutex.Unlock()

	log.Printf("Monitoramento encerrado para PLC %d: %s", plcConfig.ID, plcConfig.Name)
}

// monitorPLCTags implementa o monitoramento das tags de um PLC
func (m *PLCManager) monitorPLCTags(ctx context.Context, plcConfig domain.PLC, conn *PLCConnection) {
	log.Printf("Iniciando monitoramento de tags para PLC %d: %s", plcConfig.ID, plcConfig.Name)

	// Mapa para armazenar valores anteriores para comparação
	lastValues := make(map[int]interface{})

	// Buscar todas as tags do PLC
	tags, err := m.tagRepo.GetPLCTags(plcConfig.ID)
	if err != nil {
		log.Printf("Erro ao buscar tags do PLC %d: %v", plcConfig.ID, err)
		return
	}

	// Agrupar tags por taxa de scan
	tagsByRate := make(map[int][]domain.PLCTag)
	for _, tag := range tags {
		if !tag.Active {
			continue
		}
		tagsByRate[tag.ScanRate] = append(tagsByRate[tag.ScanRate], tag)
	}

	var wg sync.WaitGroup

	// Criar uma goroutine para cada grupo de taxa de scan
	for scanRate, tagsGroup := range tagsByRate {
		wg.Add(1)
		go func(rate int, tags []domain.PLCTag) {
			defer wg.Done()

			log.Printf("PLC %d: Monitorando %d tags com taxa de %d ms",
				plcConfig.ID, len(tags), rate)

			ticker := time.NewTicker(time.Duration(rate) * time.Millisecond)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					log.Printf("PLC %d: Encerrando monitoramento de %d tags",
						plcConfig.ID, len(tags))
					return

				case <-ticker.C:
					// Ler valor de cada tag no grupo
					updatedValues := make([]domain.TagValue, 0, len(tags))

					for _, tag := range tags {
						// Converter ByteOffset de float64 para int
						byteOffset := int(tag.ByteOffset)

						value, err := conn.ReadTag(
							tag.DBNumber,
							byteOffset,
							tag.DataType,
							tag.BitOffset,
						)

						if err != nil {
							log.Printf("Erro ao ler tag %s (ID=%d): %v",
								tag.Name, tag.ID, err)

							// Incrementar contador de erros
							m.statsMutex.Lock()
							m.stats.ReadErrors++
							if connStats, exists := m.stats.ConnectionStats[plcConfig.ID]; exists {
								connStats.ReadErrors++
								m.stats.ConnectionStats[plcConfig.ID] = connStats
							}
							m.statsMutex.Unlock()
							continue
						}

						// Verificar se precisamos atualizar o cache
						shouldUpdate := true

						// Se a tag monitora apenas mudanças
						if tag.MonitorChanges {
							// Buscar valor anterior
							lastValue, exists := lastValues[tag.ID]

							// Comparar com valor atual
							if exists {
								if plc.CompareValues(lastValue, value) {
									// Valores iguais, não atualizar
									shouldUpdate = false
								}
							}
						}

						if shouldUpdate {
							// Atualizar valor no mapa local
							lastValues[tag.ID] = value

							// Adicionar ao lote para atualização
							updatedValues = append(updatedValues, domain.TagValue{
								PLCID:     plcConfig.ID,
								TagID:     tag.ID,
								Value:     value,
								Timestamp: time.Now(),
							})

							// NOVO - Logging detalhado de valores
							if m.enableDetailedLogging {
								// Formatação mais legível do valor baseado no tipo de dados
								var valorFormatado string
								switch tag.DataType {
								case "real":
									if v, ok := value.(float32); ok {
										valorFormatado = fmt.Sprintf("%.3f", v)
									} else {
										valorFormatado = fmt.Sprintf("%v", value)
									}
								case "bool":
									if v, ok := value.(bool); ok {
										if v {
											valorFormatado = "TRUE"
										} else {
											valorFormatado = "FALSE"
										}
									} else {
										valorFormatado = fmt.Sprintf("%v", value)
									}
								default:
									valorFormatado = fmt.Sprintf("%v", value)
								}

								// Log detalhado com formato consistente para facilitar leitura
								log.Printf("[PLC:%s] [TAG:%s] [TIPO:%s] [VALOR:%s] [DB%d.DBX%d.%d]",
									plcConfig.Name,
									tag.Name,
									tag.DataType,
									valorFormatado,
									tag.DBNumber,
									byteOffset,
									tag.BitOffset)
							}
						}
					}

					// Atualizar valores em lote para melhor performance
					if len(updatedValues) > 0 {
						if err := m.cache.BatchSetTagValues(updatedValues); err != nil {
							log.Printf("Erro ao atualizar valores em lote: %v", err)
						} else {
							// Atualizar estatísticas
							m.statsMutex.Lock()
							m.stats.TagsRead += int64(len(updatedValues))
							m.statsMutex.Unlock()
						}
					}
				}
			}
		}(scanRate, tagsGroup)
	}

	// Aguardar cancelamento do contexto
	<-ctx.Done()
	log.Printf("PLC %d: Aguardando encerramento de goroutines", plcConfig.ID)
	wg.Wait()
}

// GetConnectionByPLCID retorna uma conexão ativa com um PLC
func (m *PLCManager) GetConnectionByPLCID(plcID int) (*PLCConnection, error) {
	m.connectionsMutex.RLock()
	defer m.connectionsMutex.RUnlock()

	conn, exists := m.activeConnections[plcID]
	if !exists {
		return nil, fmt.Errorf("não há conexão ativa com o PLC %d", plcID)
	}

	if !conn.IsActive() {
		return nil, fmt.Errorf("a conexão com o PLC %d está inativa", plcID)
	}

	return conn, nil
}

// WriteTagByName encontra uma tag pelo nome e escreve um valor nela
func (m *PLCManager) WriteTagByName(tagName string, value interface{}) error {
	log.Printf("Solicitação para escrever na tag '%s': %v", tagName, value)

	// Buscar tags pelo nome
	tags, err := m.tagRepo.GetByName(tagName)
	if err != nil {
		return fmt.Errorf("erro ao buscar tag '%s': %v", tagName, err)
	}

	if len(tags) == 0 {
		return fmt.Errorf("tag '%s' não encontrada", tagName)
	}

	// Usar a primeira tag encontrada
	tag := tags[0]

	// Verificar se a tag permite escrita
	if !tag.CanWrite {
		return fmt.Errorf("tag '%s' não permite escrita", tagName)
	}

	// Buscar conexão com o PLC
	conn, err := m.GetConnectionByPLCID(tag.PLCID)
	if err != nil {
		return fmt.Errorf("erro de conexão: %v", err)
	}

	// Converter ByteOffset para inteiro
	byteOffset := int(tag.ByteOffset)

	// Escrever o valor na tag
	if err := conn.WriteTag(
		tag.DBNumber,
		byteOffset,
		tag.DataType,
		tag.BitOffset,
		value,
	); err != nil {
		// Incrementar contador de erros
		m.statsMutex.Lock()
		m.stats.WriteErrors++
		if connStats, exists := m.stats.ConnectionStats[tag.PLCID]; exists {
			connStats.WriteErrors++
			m.stats.ConnectionStats[tag.PLCID] = connStats
		}
		m.statsMutex.Unlock()

		return fmt.Errorf("erro ao escrever no PLC: %v", err)
	}

	// Atualizar o valor no cache para feedback imediato
	err = m.cache.SetTagValue(tag.PLCID, tag.ID, value)
	if err != nil {
		log.Printf("Erro ao atualizar cache: %v", err)
	}

	// Incrementar contador de tags escritas
	m.statsMutex.Lock()
	m.stats.TagsWritten++
	m.statsMutex.Unlock()

	log.Printf("Valor escrito com sucesso na tag %s", tagName)
	return nil
}
