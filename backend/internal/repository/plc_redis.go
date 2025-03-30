package repository

import (
	"app_padrao/internal/domain"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// PLCRedisRepository implementa a interface PLCRepository usando Redis
type PLCRedisRepository struct {
	client *redis.Client
	ctx    context.Context
}

// NewPLCRedisRepository cria um novo repositório Redis para PLCs
func NewPLCRedisRepository(client *redis.Client) *PLCRedisRepository {
	return &PLCRedisRepository{
		client: client,
		ctx:    context.Background(),
	}
}

// chavesPadronizadas para garantir consistência
const (
	plcKeyPrefix       = "plc:"
	plcListKey         = "plcs:list"
	plcActivesListKey  = "plcs:active"
	plcStatusKeyPrefix = "plcstatus:"
)

// GetByID busca um PLC pelo ID no Redis
func (r *PLCRedisRepository) GetByID(id int) (domain.PLC, error) {
	key := fmt.Sprintf("%s%d", plcKeyPrefix, id)

	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return domain.PLC{}, domain.ErrPLCNotFound
		}
		return domain.PLC{}, err
	}

	var plc domain.PLC
	if err := json.Unmarshal([]byte(data), &plc); err != nil {
		return domain.PLC{}, err
	}

	// Buscar status também
	statusKey := fmt.Sprintf("%s%d", plcStatusKeyPrefix, id)
	statusData, err := r.client.Get(r.ctx, statusKey).Result()
	if err == nil {
		var status struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal([]byte(statusData), &status); err == nil {
			plc.Status = status.Status
		}
	} else {
		plc.Status = "unknown"
	}

	return plc, nil
}

// GetAll retorna todos os PLCs armazenados no Redis
func (r *PLCRedisRepository) GetAll() ([]domain.PLC, error) {
	// Obter todos os IDs de PLCs armazenados
	ids, err := r.client.SMembers(r.ctx, plcListKey).Result()
	if err != nil {
		return nil, err
	}

	var plcs []domain.PLC
	for _, idStr := range ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			log.Printf("ID de PLC inválido no Redis: %s", idStr)
			continue
		}

		plc, err := r.GetByID(id)
		if err != nil {
			log.Printf("Erro ao buscar PLC %d: %v", id, err)
			continue
		}

		plcs = append(plcs, plc)
	}

	return plcs, nil
}

// GetActivePLCs retorna apenas PLCs ativos do Redis
func (r *PLCRedisRepository) GetActivePLCs() ([]domain.PLC, error) {
	// Obter IDs de PLCs ativos
	ids, err := r.client.SMembers(r.ctx, plcActivesListKey).Result()
	if err != nil {
		return nil, err
	}

	var plcs []domain.PLC
	for _, idStr := range ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			log.Printf("ID de PLC inválido no Redis: %s", idStr)
			continue
		}

		plc, err := r.GetByID(id)
		if err != nil {
			log.Printf("Erro ao buscar PLC %d: %v", id, err)
			continue
		}

		plcs = append(plcs, plc)
	}

	return plcs, nil
}

// Create cria um novo PLC no Redis
func (r *PLCRedisRepository) Create(plc domain.PLC) (int, error) {
	// O ID deve vir do PostgreSQL, não definimos aqui
	if plc.ID <= 0 {
		return 0, fmt.Errorf("ID de PLC inválido para criação no Redis")
	}

	key := fmt.Sprintf("%s%d", plcKeyPrefix, plc.ID)

	// Serializar PLC para JSON
	data, err := json.Marshal(plc)
	if err != nil {
		return 0, err
	}

	// Salvar no Redis
	pipe := r.client.Pipeline()
	pipe.Set(r.ctx, key, data, 0) // Sem expiração
	pipe.SAdd(r.ctx, plcListKey, strconv.Itoa(plc.ID))

	// Se estiver ativo, adicionar à lista de ativos
	if plc.Active {
		pipe.SAdd(r.ctx, plcActivesListKey, strconv.Itoa(plc.ID))
	}

	// Adicionar status inicial
	statusKey := fmt.Sprintf("%s%d", plcStatusKeyPrefix, plc.ID)
	statusData, _ := json.Marshal(map[string]interface{}{
		"status":      "unknown",
		"last_update": time.Now(),
	})
	pipe.Set(r.ctx, statusKey, statusData, 0)

	_, err = pipe.Exec(r.ctx)
	if err != nil {
		return 0, err
	}

	return plc.ID, nil
}

// Update atualiza um PLC existente no Redis
func (r *PLCRedisRepository) Update(plc domain.PLC) error {
	if plc.ID <= 0 {
		return fmt.Errorf("ID de PLC inválido para atualização no Redis")
	}

	// Verificar se o PLC existe
	key := fmt.Sprintf("%s%d", plcKeyPrefix, plc.ID)
	exists, err := r.client.Exists(r.ctx, key).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return domain.ErrPLCNotFound
	}

	// Serializar PLC para JSON
	plc.UpdatedAt = time.Now()
	data, err := json.Marshal(plc)
	if err != nil {
		return err
	}

	// Atualizar no Redis
	pipe := r.client.Pipeline()
	pipe.Set(r.ctx, key, data, 0) // Sem expiração

	// Atualizar a lista de ativos
	if plc.Active {
		pipe.SAdd(r.ctx, plcActivesListKey, strconv.Itoa(plc.ID))
	} else {
		pipe.SRem(r.ctx, plcActivesListKey, strconv.Itoa(plc.ID))
	}

	_, err = pipe.Exec(r.ctx)
	return err
}

// Delete remove um PLC do Redis
func (r *PLCRedisRepository) Delete(id int) error {
	key := fmt.Sprintf("%s%d", plcKeyPrefix, id)

	// Verificar se o PLC existe
	exists, err := r.client.Exists(r.ctx, key).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return domain.ErrPLCNotFound
	}

	// Remover PLC e suas referências
	pipe := r.client.Pipeline()
	pipe.Del(r.ctx, key)
	pipe.SRem(r.ctx, plcListKey, strconv.Itoa(id))
	pipe.SRem(r.ctx, plcActivesListKey, strconv.Itoa(id))
	pipe.Del(r.ctx, fmt.Sprintf("%s%d", plcStatusKeyPrefix, id))

	_, err = pipe.Exec(r.ctx)
	return err
}

// UpdatePLCStatus atualiza o status de um PLC no Redis
func (r *PLCRedisRepository) UpdatePLCStatus(status domain.PLCStatus) error {
	statusKey := fmt.Sprintf("%s%d", plcStatusKeyPrefix, status.PLCID)

	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	return r.client.Set(r.ctx, statusKey, data, 0).Err()
}
