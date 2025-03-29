package service

import (
	"app_padrao/internal/domain"
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

// connectPLC tenta se conectar ao PLC usando o código da biblioteca gos7
func (m *plcManager) connectPLC(ip string, rack, slot int) (*PLCConnection, error) {
	// Esta função seria usada para conectar ao PLC
	// Como não temos a biblioteca plc aqui, criamos um stub
	return &PLCConnection{
		ip:   ip,
		rack: rack,
		slot: slot,
	}, nil
}

// PLCConnection é um mock da conexão com o PLC
type PLCConnection struct {
	ip   string
	rack int
	slot int
}

// Ping simula checagem de conectividade
func (p *PLCConnection) Ping() error {
	// Em um cenário real, isto iria verificar a conexão com o PLC
	return nil
}

// Close simula o fechamento da conexão
func (p *PLCConnection) Close() {
	// Em um cenário real, isto iria fechar a conexão
}

// ReadTag simula leitura de uma tag
func (p *PLCConnection) ReadTag(dbNumber, byteOffset int, dataType string) (interface{}, error) {
	// Em um cenário real, implementaria a leitura da tag
	return 0, nil
}

// WriteTag simula escrita em uma tag
func (p *PLCConnection) WriteTag(dbNumber, byteOffset int, dataType string, value interface{}) error {
	// Em um cenário real, implementaria a escrita na tag
	return nil
}

// runAllPLCs consulta os PLCs ativos e inicia uma rotina de gerenciamento para cada um.
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
						delete(plcCancels, plc.ID)
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

					_, cancel := context.WithCancel(ctx)
					plcCancels[plc.ID] = struct {
						cancel context.CancelFunc
						config domain.PLC
					}{
						cancel: cancel,
						config: plc,
					}

					go func(p domain.PLC) {
						log.Printf("Iniciando monitoramento do PLC: %s (%s)", p.Name, p.IPAddress)
						// Implementação real chamaria o código PLC
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

				// Atualizar o valor no cache (para feedback rápido)
				if err := m.cache.SetTagValue(plcConfig.ID, tag.ID, convertedValue); err != nil {
					log.Printf("Erro ao atualizar cache: %v", err)
					return err
				} else {
					log.Printf("Valor da tag '%s' atualizado no cache com sucesso", tagName)
				}

				// Em um sistema real, implementaria a escrita no PLC
				// Aqui apenas simulamos
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
