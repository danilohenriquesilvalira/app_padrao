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

// TagConfig guarda os parâmetros para o monitoramento de uma tag.
type TagConfig struct {
	ScanRate       time.Duration
	MonitorChanges bool
}

// TagRunner guarda o cancelamento da goroutine de coleta e a configuração aplicada.
type TagRunner struct {
	cancel context.CancelFunc
	config TagConfig
}

// plcManager encapsula a lógica de gerenciamento dos PLCs
type plcManager struct {
	plcRepo domain.PLCRepository
	tagRepo domain.PLCTagRepository
	cache   domain.PLCCache

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func newPLCManager(
	plcRepo domain.PLCRepository,
	tagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
) *plcManager {
	return &plcManager{
		plcRepo: plcRepo,
		tagRepo: tagRepo,
		cache:   cache,
	}
}

// Start inicia o monitoramento dos PLCs
func (m *plcManager) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	m.ctx = ctx
	m.cancel = cancel

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		m.runAllPLCs(ctx)
	}()

	return nil
}

// Stop para o monitoramento dos PLCs
func (m *plcManager) Stop() {
	if m.cancel != nil {
		m.cancel()
	}
	m.wg.Wait()
}

// isCriticalError verifica se o erro indica perda de conexão (crítico).
func isCriticalError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "forçado") || strings.Contains(lower, "cancelado")
}

// connectPLC tenta se conectar ao PLC
func (m *plcManager) connectPLC(ip string, rack, slot int) (*PLCConnection, error) {
	log.Printf("Conectando ao PLC: %s (Rack: %d, Slot: %d)", ip, rack, slot)
	// Esta função seria usada para conectar ao PLC
	// Como não temos a biblioteca plc aqui, criamos um stub
	conn := &PLCConnection{
		ip:   ip,
		rack: rack,
		slot: slot,
	}

	// Simular verificação de conexão
	err := conn.Ping()
	if err != nil {
		return nil, fmt.Errorf("falha ao conectar ao PLC: %v", err)
	}

	log.Printf("Conectado ao PLC: %s", ip)
	return conn, nil
}

// PLCConnection é a implementação da conexão com o PLC
type PLCConnection struct {
	ip     string
	rack   int
	slot   int
	client interface{} // Aqui seria substituído pela biblioteca real de comunicação PLC
}

// Ping verifica se o PLC está online
func (p *PLCConnection) Ping() error {
	// Em um cenário real, isto iria verificar a conexão com o PLC
	log.Printf("Verificando conexão com PLC: %s", p.ip)
	return nil
}

// Close fecha a conexão com o PLC
func (p *PLCConnection) Close() {
	// Em um cenário real, isto iria fechar a conexão
	log.Printf("Fechando conexão com PLC: %s", p.ip)
}

// ReadTag lê uma tag do PLC considerando byte e bit offset
func (p *PLCConnection) ReadTag(dbNumber, byteOffset, bitOffset int, dataType string) (interface{}, error) {
	log.Printf("Lendo tag DB%d.DBX%d.%d do tipo %s", dbNumber, byteOffset, bitOffset, dataType)

	// Em um cenário real, implementaria a leitura da tag considerando o bit offset
	// Para tipos booleanos, precisamos ler o byte e extrair o bit específico
	if dataType == "bool" && bitOffset >= 0 && bitOffset <= 7 {
		// Simula leitura do byte
		var byteLido byte = 0xAA // 10101010 em binário

		// Extrai o bit específico
		bitValue := (byteLido & (1 << bitOffset)) != 0
		log.Printf("Valor booleano lido: %v (bit %d do byte 0x%02X)", bitValue, bitOffset, byteLido)
		return bitValue, nil
	}

	// Para outros tipos, ignoramos o bit offset (só aplicável a booleanos)
	switch dataType {
	case "real":
		return float32(123.45), nil
	case "int":
		return int16(42), nil
	case "word":
		return uint16(1024), nil
	case "string":
		return "exemplo", nil
	default:
		return nil, fmt.Errorf("tipo de dados não suportado: %s", dataType)
	}
}

// WriteTag escreve uma tag no PLC considerando byte e bit offset
func (p *PLCConnection) WriteTag(dbNumber, byteOffset, bitOffset int, dataType string, value interface{}) error {
	log.Printf("Escrevendo valor %v na tag DB%d.DBX%d.%d do tipo %s", value, dbNumber, byteOffset, bitOffset, dataType)

	// Em um cenário real, implementaria a escrita na tag considerando o bit offset
	// Para tipos booleanos, precisamos ler o byte atual, modificar o bit específico e escrever de volta
	if dataType == "bool" && bitOffset >= 0 && bitOffset <= 7 {
		// Converter o valor para booleano
		boolValue, ok := value.(bool)
		if !ok {
			return fmt.Errorf("valor %v não pode ser convertido para bool", value)
		}

		// Simula leitura do byte atual
		var byteAtual byte = 0xAA // 10101010 em binário

		// Modifica o bit específico
		if boolValue {
			byteAtual |= (1 << bitOffset) // Ativa o bit
		} else {
			byteAtual &= ^(1 << bitOffset) // Desativa o bit
		}

		// Em um cenário real, escreveria o byte modificado de volta para o PLC
		log.Printf("Byte modificado: 0x%02X", byteAtual)
		return nil
	}

	// Para outros tipos, ignoramos o bit offset (só aplicável a booleanos)
	log.Printf("Valor escrito com sucesso")
	return nil
}

// monitorPLCTags implementa o monitoramento real das tags de um PLC
func (m *plcManager) monitorPLCTags(ctx context.Context, plcConfig domain.PLC, conn *PLCConnection) {
	log.Printf("Iniciando monitoramento de tags para PLC: %s (%s)", plcConfig.Name, plcConfig.IPAddress)

	// Mapa para armazenar o último valor de cada tag
	lastValues := make(map[int]interface{})

	// Buscar as tags do PLC
	tags, err := m.tagRepo.GetPLCTags(plcConfig.ID)
	if err != nil {
		log.Printf("Erro ao buscar tags do PLC %s: %v", plcConfig.Name, err)
		return
	}

	log.Printf("PLC %s tem %d tags para monitorar", plcConfig.Name, len(tags))

	// Agrupar tags por taxa de scan para otimização
	tagsByRate := make(map[int][]domain.PLCTag)
	for _, tag := range tags {
		if !tag.Active {
			continue
		}
		tagsByRate[tag.ScanRate] = append(tagsByRate[tag.ScanRate], tag)
	}

	var wg sync.WaitGroup

	// Criar uma goroutine para cada grupo de taxa de scan
	for scanRate, scanTags := range tagsByRate {
		wg.Add(1)
		go func(rate int, tags []domain.PLCTag) {
			defer wg.Done()

			log.Printf("Iniciando monitoramento de %d tags com taxa de %d ms para PLC %s",
				len(tags), rate, plcConfig.Name)

			ticker := time.NewTicker(time.Duration(rate) * time.Millisecond)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					log.Printf("Encerrando monitoramento de %d tags com taxa de %d ms para PLC %s",
						len(tags), rate, plcConfig.Name)
					return
				case <-ticker.C:
					// Ler cada tag no grupo
					for _, tag := range tags {
						// Ler o valor atual da tag
						value, err := conn.ReadTag(tag.DBNumber, tag.ByteOffset, tag.BitOffset, tag.DataType)
						if err != nil {
							log.Printf("Erro ao ler tag %s: %v", tag.Name, err)
							continue
						}

						// Verificar se precisamos atualizar o cache
						shouldUpdate := true

						// Se a tag está configurada para monitorar apenas mudanças
						if tag.MonitorChanges {
							// Buscar último valor conhecido
							lastValue, exists := lastValues[tag.ID]

							// Se temos um valor anterior, comparar com o atual
							if exists {
								// Usar nossa função personalizada para comparar valores
								if plc.CompareValues(lastValue, value) {
									// Valores são iguais, não atualizar
									shouldUpdate = false
								} else {
									log.Printf("Tag %s: valor mudou de %v para %v",
										tag.Name, lastValue, value)
								}
							}
						}

						if shouldUpdate {
							// Atualizar o cache com o novo valor
							if err := m.cache.SetTagValue(plcConfig.ID, tag.ID, value); err != nil {
								log.Printf("Erro ao atualizar cache para tag %s: %v", tag.Name, err)
							} else {
								// Atualizar o último valor conhecido
								lastValues[tag.ID] = value
								log.Printf("Tag %s atualizada: %v", tag.Name, value)
							}
						}
					}
				}
			}
		}(scanRate, scanTags)
	}

	// Aguardar o contexto ser cancelado
	<-ctx.Done()
	log.Printf("Contexto cancelado para PLC %s, aguardando goroutines encerrarem", plcConfig.Name)
	wg.Wait()
	log.Printf("Monitoramento encerrado para PLC %s", plcConfig.Name)
}

// runAllPLCs consulta os PLCs ativos e inicia uma rotina de gerenciamento para cada um
func (m *plcManager) runAllPLCs(ctx context.Context) {
	// Verificações de segurança para parâmetros nulos
	if m.plcRepo == nil {
		log.Printf("Erro crítico: repositório nulo para gerenciamento de PLCs")
		return
	}

	if m.cache == nil {
		log.Printf("Erro crítico: cache nulo para gerenciamento de PLCs")
		return
	}

	plcCancels := make(map[int]struct {
		cancel context.CancelFunc
		config domain.PLC
	})

	// Reduzido para 5 segundos para detecção mais rápida de mudanças
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	log.Println("Iniciando monitoramento de PLCs...")

	for {
		select {
		case <-ctx.Done():
			for _, p := range plcCancels {
				p.cancel()
			}
			log.Println("Monitoramento de PLCs encerrado")
			return

		case <-ticker.C:
			plcs, err := m.plcRepo.GetActivePLCs()
			if err != nil {
				log.Printf("Erro ao carregar PLCs: %v", err)
				continue
			}

			log.Printf("Verificando %d PLCs ativos", len(plcs))

			// Remove PLCs inativos primeiro
			for plcID, p := range plcCancels {
				found := false
				for _, plc := range plcs {
					if plc.ID == plcID {
						found = true
						break
					}
				}
				if !found {
					p.cancel()
					delete(plcCancels, plcID)
					log.Printf("Removendo monitoramento do PLC ID %d - não está mais ativo", plcID)
				}
			}

			// Depois verifica novos PLCs ou mudanças
			for _, plc := range plcs {
				// Validações básicas para garantir que os dados do PLC são válidos
				if plc.IPAddress == "" {
					log.Printf("PLC com endereço IP vazio: ID: %d, Nome: %s", plc.ID, plc.Name)
					continue
				}

				current, exists := plcCancels[plc.ID]

				// Adiciona detecção de mudança de nome
				if !exists ||
					current.config.IPAddress != plc.IPAddress ||
					current.config.Rack != plc.Rack ||
					current.config.Slot != plc.Slot ||
					current.config.Name != plc.Name {

					if exists {
						current.cancel()
						delete(plcCancels, plc.ID) // Corrigido: agora usando plc.ID em vez de plcID
						log.Printf("Reiniciando PLC %s (ID: %d) devido a mudança de configuração", plc.Name, plc.ID)

						// Log detalhado da alteração
						var changes []string
						if current.config.Name != plc.Name {
							changes = append(changes, fmt.Sprintf("Nome: %s -> %s", current.config.Name, plc.Name))
						}
						if current.config.IPAddress != plc.IPAddress {
							changes = append(changes, fmt.Sprintf("IP: %s -> %s", current.config.IPAddress, plc.IPAddress))
						}
						if current.config.Rack != plc.Rack {
							changes = append(changes, fmt.Sprintf("Rack: %d -> %d", current.config.Rack, plc.Rack))
						}
						if current.config.Slot != plc.Slot {
							changes = append(changes, fmt.Sprintf("Slot: %d -> %d", current.config.Slot, plc.Slot))
						}

						log.Printf("Alterações: %s", strings.Join(changes, ", "))
					}

					ctx, cancel := context.WithCancel(ctx)
					plcCancels[plc.ID] = struct {
						cancel context.CancelFunc
						config domain.PLC
					}{
						cancel: cancel,
						config: plc,
					}

					go func(p domain.PLC) {
						log.Printf("Iniciando monitoramento do PLC: %s (%s)", p.Name, p.IPAddress)

						// Tentar conectar ao PLC
						conn, err := m.connectPLC(p.IPAddress, p.Rack, p.Slot)
						if err != nil {
							log.Printf("Erro ao conectar ao PLC %s: %v", p.Name, err)
							// Atualizar status do PLC para "offline"
							statusErr := m.plcRepo.UpdatePLCStatus(domain.PLCStatus{
								PLCID:      p.ID,
								Status:     "offline",
								LastUpdate: time.Now(),
							})
							if statusErr != nil {
								log.Printf("Erro ao atualizar status do PLC %s: %v", p.Name, statusErr)
							}
							return
						}
						defer conn.Close()

						// Atualizar status do PLC para "online"
						statusErr := m.plcRepo.UpdatePLCStatus(domain.PLCStatus{
							PLCID:      p.ID,
							Status:     "online",
							LastUpdate: time.Now(),
						})
						if statusErr != nil {
							log.Printf("Erro ao atualizar status do PLC %s: %v", p.Name, statusErr)
						}

						// Criar contexto cancelável para este PLC usando o contexto já criado
						m.monitorPLCTags(ctx, p, conn)
					}(plc)
				}
			}
		}
	}
}

// WriteTagByName encontra uma tag pelo nome em todos os PLCs e escreve o valor nela
func (m *plcManager) WriteTagByName(tagName string, value interface{}) error {
	log.Printf("Solicitação para escrever na tag '%s': %v", tagName, value)

	// Buscar PLCs ativos
	plcs, err := m.plcRepo.GetActivePLCs()
	if err != nil {
		log.Printf("Erro ao buscar PLCs ativos: %v", err)
		return err
	}

	// Procurar a tag em todos os PLCs
	for _, plcConfig := range plcs {
		// Verificar se o PLC está online
		if plcConfig.Status != "online" {
			log.Printf("PLC %s (ID=%d) está offline, ignorando", plcConfig.Name, plcConfig.ID)
			continue
		}

		// Buscar tags do PLC
		tags, err := m.tagRepo.GetPLCTags(plcConfig.ID)
		if err != nil {
			log.Printf("Erro ao buscar tags do PLC %s (ID=%d): %v", plcConfig.Name, plcConfig.ID, err)
			continue
		}

		// Procurar a tag pelo nome
		for _, tag := range tags {
			if tag.Name == tagName {
				log.Printf("Tag '%s' encontrada no PLC %s (ID=%d)", tagName, plcConfig.Name, plcConfig.ID)

				// Verificar se a tag permite escrita
				if !tag.CanWrite {
					log.Printf("Tag '%s' não permite escrita", tagName)
					return fmt.Errorf("tag '%s' não permite escrita", tagName)
				}

				// Converter valor para o tipo correto conforme DataType
				convertedValue, err := convertValue(value, tag.DataType)
				if err != nil {
					return fmt.Errorf("erro ao converter valor: %v", err)
				}

				// Conectar ao PLC
				conn, err := m.connectPLC(plcConfig.IPAddress, plcConfig.Rack, plcConfig.Slot)
				if err != nil {
					return fmt.Errorf("erro ao conectar ao PLC: %v", err)
				}
				defer conn.Close()

				// Escrever o valor na tag, considerando o bit offset
				if err := conn.WriteTag(tag.DBNumber, tag.ByteOffset, tag.BitOffset, tag.DataType, convertedValue); err != nil {
					return fmt.Errorf("erro ao escrever no PLC: %v", err)
				}

				// Atualizar o valor no cache (para feedback rápido)
				if err := m.cache.SetTagValue(plcConfig.ID, tag.ID, convertedValue); err != nil {
					log.Printf("Erro ao atualizar cache: %v", err)
					return err
				} else {
					log.Printf("Valor da tag '%s' atualizado no cache com sucesso", tagName)
				}

				log.Printf("Valor escrito com sucesso no PLC para tag %s", tagName)
				return nil
			}
		}
	}

	return fmt.Errorf("tag '%s' não encontrada em nenhum PLC", tagName)
}

// convertValue converte o valor recebido para o tipo correto conforme o DataType da tag
func convertValue(value interface{}, dataType string) (interface{}, error) {
	switch dataType {
	case "real":
		switch v := value.(type) {
		case float64:
			return float32(v), nil
		case float32:
			return v, nil
		case int:
			return float32(v), nil
		case string:
			var f float64
			if _, err := fmt.Sscanf(v, "%f", &f); err != nil {
				return nil, fmt.Errorf("erro ao converter string para float: %v", err)
			}
			return float32(f), nil
		default:
			return nil, fmt.Errorf("não foi possível converter %T para float32", value)
		}

	case "int":
		switch v := value.(type) {
		case float64:
			return int16(v), nil
		case int:
			return int16(v), nil
		case string:
			var i int
			if _, err := fmt.Sscanf(v, "%d", &i); err != nil {
				return nil, fmt.Errorf("erro ao converter string para int: %v", err)
			}
			return int16(i), nil
		default:
			return nil, fmt.Errorf("não foi possível converter %T para int16", value)
		}

	case "word":
		switch v := value.(type) {
		case float64:
			return uint16(v), nil
		case int:
			return uint16(v), nil
		case string:
			var i int
			if _, err := fmt.Sscanf(v, "%d", &i); err != nil {
				return nil, fmt.Errorf("erro ao converter string para uint16: %v", err)
			}
			return uint16(i), nil
		default:
			return nil, fmt.Errorf("não foi possível converter %T para uint16", value)
		}

	case "bool":
		switch v := value.(type) {
		case bool:
			return v, nil
		case float64:
			return v != 0, nil
		case int:
			return v != 0, nil
		case string:
			return v == "true" || v == "1" || v == "yes", nil
		default:
			return nil, fmt.Errorf("não foi possível converter %T para bool", value)
		}

	case "string":
		return fmt.Sprint(value), nil

	default:
		return nil, fmt.Errorf("tipo não suportado: %s", dataType)
	}
}
