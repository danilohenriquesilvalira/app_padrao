package domain

import (
	"errors"
	"time"

	"github.com/go-redis/redis/v8"
)

// PLC representa um dispositivo PLC no sistema
type PLC struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	IPAddress string    `json:"ip_address"`
	Rack      int       `json:"rack"`
	Slot      int       `json:"slot"`
	Active    bool      `json:"is_active"`
	Status    string    `json:"status,omitempty"` // Campo transitório
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

// PLCTag representa uma tag monitorada em um PLC
type PLCTag struct {
	ID             int         `json:"id"`
	PLCID          int         `json:"plc_id"`
	Name           string      `json:"name"`
	Description    string      `json:"description"`
	DBNumber       int         `json:"db_number"`
	ByteOffset     int         `json:"byte_offset"`
	BitOffset      int         `json:"bit_offset"` // Offset de bit (0-7)
	DataType       string      `json:"data_type"`  // "real", "int", "word", "bool", "string"
	ScanRate       int         `json:"scan_rate"`  // em milissegundos
	MonitorChanges bool        `json:"monitor_changes"`
	CanWrite       bool        `json:"can_write"`
	Active         bool        `json:"active"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at,omitempty"`
	CurrentValue   interface{} `json:"current_value,omitempty"` // Não persistido
}

// PLCStatus representa o status de um PLC
type PLCStatus struct {
	PLCID      int       `json:"plc_id"`
	Status     string    `json:"status"` // "online", "offline", "unknown"
	LastUpdate time.Time `json:"last_update"`
}

// TagValue representa um valor de tag armazenado
type TagValue struct {
	PLCID     int         `json:"plc_id"`
	TagID     int         `json:"tag_id"`
	Value     interface{} `json:"value"`
	Timestamp time.Time   `json:"timestamp"`
}

// PLCConnectionStats contém estatísticas de uma conexão com PLC
type PLCConnectionStats struct {
	PLCID         int       `json:"plc_id"`
	Name          string    `json:"name"`
	Status        string    `json:"status"`
	TagCount      int       `json:"tag_count"`
	LastConnected time.Time `json:"last_connected"`
	ReadErrors    int64     `json:"read_errors"`
	WriteErrors   int64     `json:"write_errors"`
}

// PLCManagerStats contém estatísticas do gerenciador de PLCs
type PLCManagerStats struct {
	ActivePLCs      int                        `json:"active_plcs"`
	TotalTags       int                        `json:"total_tags"`
	TagsRead        int64                      `json:"tags_read"`
	TagsWritten     int64                      `json:"tags_written"`
	ReadErrors      int64                      `json:"read_errors"`
	WriteErrors     int64                      `json:"write_errors"`
	LastUpdated     time.Time                  `json:"last_updated"`
	ConnectionStats map[int]PLCConnectionStats `json:"connections"`
}

// PLCRepository define operações com PLCs no banco de dados
type PLCRepository interface {
	GetByID(id int) (PLC, error)
	GetAll() ([]PLC, error)
	GetActivePLCs() ([]PLC, error)
	Create(plc PLC) (int, error)
	Update(plc PLC) error
	Delete(id int) error
	UpdatePLCStatus(status PLCStatus) error
}

// PLCTagRepository define operações com tags de PLCs no banco de dados
type PLCTagRepository interface {
	GetByID(id int) (PLCTag, error)
	GetByName(name string) ([]PLCTag, error)
	GetPLCTags(plcID int) ([]PLCTag, error)
	Create(tag PLCTag) (int, error)
	Update(tag PLCTag) error
	Delete(id int) error
}

// PLCService define as operações disponíveis para PLCs
type PLCService interface {
	GetByID(id int) (PLC, error)
	GetAll() ([]PLC, error)
	GetActivePLCs() ([]PLC, error)
	Create(plc PLC) (int, error)
	Update(plc PLC) error
	Delete(id int) error

	GetPLCTags(plcID int) ([]PLCTag, error)
	GetTagByID(id int) (PLCTag, error)
	GetTagByName(name string) ([]PLCTag, error)
	CreateTag(tag PLCTag) (int, error)
	UpdateTag(tag PLCTag) error
	DeleteTag(id int) error

	StartMonitoring() error
	StopMonitoring() error
	WriteTagValue(tagName string, value interface{}) error
	GetTagValue(plcID int, tagID int) (*TagValue, error)
	GetPLCStats() PLCManagerStats
}

// PLCCache define operações para cache de valores de tags
type PLCCache interface {
	SetTagValue(plcID int, tagID int, value interface{}) error
	GetTagValue(plcID int, tagID int) (*TagValue, error)
	BatchSetTagValues(values []TagValue) error
	GetMultipleTagValues(queries []struct{ PLCID, TagID int }) ([]TagValue, error)
	GetRedisClient() *redis.Client
}

// Erros comuns
var (
	ErrPLCNotFound     = errors.New("PLC não encontrado")
	ErrPLCTagNotFound  = errors.New("Tag de PLC não encontrada")
	ErrInvalidDataType = errors.New("Tipo de dados inválido")
)
