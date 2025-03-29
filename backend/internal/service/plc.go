package service

import (
	"app_padrao/internal/domain"
	"fmt"
	"log"
	"sync"
	"time"
)

type PLCService struct {
	plcRepo domain.PLCRepository
	tagRepo domain.PLCTagRepository
	cache   domain.PLCCache

	manager   *plcManager
	isRunning bool
	mu        sync.Mutex
}

func NewPLCService(
	plcRepo domain.PLCRepository,
	tagRepo domain.PLCTagRepository,
	cache domain.PLCCache,
) *PLCService {
	s := &PLCService{
		plcRepo:   plcRepo,
		tagRepo:   tagRepo,
		cache:     cache,
		isRunning: false,
	}

	s.manager = newPLCManager(s.plcRepo, s.tagRepo, s.cache)

	return s
}

func (s *PLCService) GetByID(id int) (domain.PLC, error) {
	return s.plcRepo.GetByID(id)
}

func (s *PLCService) GetAll() ([]domain.PLC, error) {
	return s.plcRepo.GetAll()
}

func (s *PLCService) GetActivePLCs() ([]domain.PLC, error) {
	return s.plcRepo.GetActivePLCs()
}

func (s *PLCService) Create(plc domain.PLC) (int, error) {
	// Validações
	if plc.Name == "" {
		return 0, fmt.Errorf("nome do PLC é obrigatório")
	}

	if plc.IPAddress == "" {
		return 0, fmt.Errorf("endereço IP do PLC é obrigatório")
	}

	plc.CreatedAt = time.Now()

	return s.plcRepo.Create(plc)
}

func (s *PLCService) Update(plc domain.PLC) error {
	// Validações
	if plc.Name == "" {
		return fmt.Errorf("nome do PLC é obrigatório")
	}

	if plc.IPAddress == "" {
		return fmt.Errorf("endereço IP do PLC é obrigatório")
	}

	return s.plcRepo.Update(plc)
}

func (s *PLCService) Delete(id int) error {
	return s.plcRepo.Delete(id)
}

func (s *PLCService) GetPLCTags(plcID int) ([]domain.PLCTag, error) {
	tags, err := s.tagRepo.GetPLCTags(plcID)
	if err != nil {
		return nil, err
	}

	// Carregar valores atuais das tags do cache
	for i := range tags {
		tagValue, err := s.cache.GetTagValue(plcID, tags[i].ID)
		if err == nil && tagValue != nil {
			tags[i].CurrentValue = tagValue.Value
		}
	}

	return tags, nil
}

func (s *PLCService) GetTagByID(id int) (domain.PLCTag, error) {
	tag, err := s.tagRepo.GetByID(id)
	if err != nil {
		return domain.PLCTag{}, err
	}

	// Carregar valor atual do cache
	tagValue, err := s.cache.GetTagValue(tag.PLCID, tag.ID)
	if err == nil && tagValue != nil {
		tag.CurrentValue = tagValue.Value
	}

	return tag, nil
}

func (s *PLCService) GetTagByName(name string) ([]domain.PLCTag, error) {
	tags, err := s.tagRepo.GetByName(name)
	if err != nil {
		return nil, err
	}

	// Carregar valores atuais das tags do cache
	for i := range tags {
		tagValue, err := s.cache.GetTagValue(tags[i].PLCID, tags[i].ID)
		if err == nil && tagValue != nil {
			tags[i].CurrentValue = tagValue.Value
		}
	}

	return tags, nil
}

func (s *PLCService) CreateTag(tag domain.PLCTag) (int, error) {
	// Validações
	if tag.Name == "" {
		return 0, fmt.Errorf("nome da tag é obrigatório")
	}

	if tag.DataType == "" {
		return 0, fmt.Errorf("tipo de dados da tag é obrigatório")
	}

	// Validar tipo de dados
	switch tag.DataType {
	case "real", "int", "word", "bool", "string":
		// Tipos válidos
	default:
		return 0, domain.ErrInvalidDataType
	}

	// Verificar se o PLC existe
	_, err := s.plcRepo.GetByID(tag.PLCID)
	if err != nil {
		return 0, err
	}

	tag.CreatedAt = time.Now()
	if tag.ScanRate <= 0 {
		tag.ScanRate = 1000 // Padrão: 1 segundo
	}

	return s.tagRepo.Create(tag)
}

func (s *PLCService) UpdateTag(tag domain.PLCTag) error {
	// Validações
	if tag.Name == "" {
		return fmt.Errorf("nome da tag é obrigatório")
	}

	if tag.DataType == "" {
		return fmt.Errorf("tipo de dados da tag é obrigatório")
	}

	// Validar tipo de dados
	switch tag.DataType {
	case "real", "int", "word", "bool", "string":
		// Tipos válidos
	default:
		return domain.ErrInvalidDataType
	}

	// Verificar se o PLC existe
	_, err := s.plcRepo.GetByID(tag.PLCID)
	if err != nil {
		return err
	}

	if tag.ScanRate <= 0 {
		tag.ScanRate = 1000 // Padrão: 1 segundo
	}

	return s.tagRepo.Update(tag)
}

func (s *PLCService) DeleteTag(id int) error {
	return s.tagRepo.Delete(id)
}

func (s *PLCService) StartMonitoring() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("monitoramento já está em execução")
	}

	err := s.manager.Start()
	if err != nil {
		return err
	}

	s.isRunning = true
	log.Println("Serviço de monitoramento de PLCs iniciado")

	return nil
}

func (s *PLCService) StopMonitoring() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return nil
	}

	s.manager.Stop()
	s.isRunning = false
	log.Println("Serviço de monitoramento de PLCs parado")

	return nil
}

func (s *PLCService) WriteTagValue(tagName string, value interface{}) error {
	return s.manager.WriteTagByName(tagName, value)
}

func (s *PLCService) GetTagValue(plcID int, tagID int) (*domain.TagValue, error) {
	return s.cache.GetTagValue(plcID, tagID)
}
