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

// PLCTagRedisRepository implementa a interface PLCTagRepository usando Redis
type PLCTagRedisRepository struct {
	client *redis.Client
	ctx    context.Context
}

// NewPLCTagRedisRepository cria um novo repositório Redis para tags de PLCs
func NewPLCTagRedisRepository(client *redis.Client) *PLCTagRedisRepository {
	return &PLCTagRedisRepository{
		client: client,
		ctx:    context.Background(),
	}
}

// chavesPadronizadas para garantir consistência
const (
	tagKeyPrefix      = "plctag:"
	tagsByPLCPrefix   = "plctags:byplc:"
	tagsByNamePrefix  = "plctags:byname:"
	tagListKey        = "plctags:list"
	tagValueKeyPrefix = "tagvalue:"
)

// GetByID busca uma tag pelo ID no Redis
func (r *PLCTagRedisRepository) GetByID(id int) (domain.PLCTag, error) {
	key := fmt.Sprintf("%s%d", tagKeyPrefix, id)

	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return domain.PLCTag{}, domain.ErrPLCTagNotFound
		}
		return domain.PLCTag{}, err
	}

	var tag domain.PLCTag
	if err := json.Unmarshal([]byte(data), &tag); err != nil {
		return domain.PLCTag{}, err
	}

	return tag, nil
}

// GetByName busca tags pelo nome no Redis
func (r *PLCTagRedisRepository) GetByName(name string) ([]domain.PLCTag, error) {
	key := fmt.Sprintf("%s%s", tagsByNamePrefix, name)

	// Buscar IDs das tags com este nome
	ids, err := r.client.SMembers(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var tags []domain.PLCTag
	for _, idStr := range ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			log.Printf("ID de tag inválido no Redis: %s", idStr)
			continue
		}

		tag, err := r.GetByID(id)
		if err != nil {
			log.Printf("Erro ao buscar tag %d: %v", id, err)
			continue
		}

		tags = append(tags, tag)
	}

	return tags, nil
}

// GetPLCTags busca todas as tags de um PLC específico
func (r *PLCTagRedisRepository) GetPLCTags(plcID int) ([]domain.PLCTag, error) {
	key := fmt.Sprintf("%s%d", tagsByPLCPrefix, plcID)

	// Buscar IDs das tags deste PLC
	ids, err := r.client.SMembers(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var tags []domain.PLCTag
	for _, idStr := range ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			log.Printf("ID de tag inválido no Redis: %s", idStr)
			continue
		}

		tag, err := r.GetByID(id)
		if err != nil {
			log.Printf("Erro ao buscar tag %d: %v", id, err)
			continue
		}

		tags = append(tags, tag)
	}

	return tags, nil
}

// Create cria uma nova tag no Redis
func (r *PLCTagRedisRepository) Create(tag domain.PLCTag) (int, error) {
	// O ID deve vir do PostgreSQL, não definimos aqui
	if tag.ID <= 0 {
		return 0, fmt.Errorf("ID de tag inválido para criação no Redis")
	}

	key := fmt.Sprintf("%s%d", tagKeyPrefix, tag.ID)

	// Serializar tag para JSON
	data, err := json.Marshal(tag)
	if err != nil {
		return 0, err
	}

	// Salvar no Redis usando pipeline para operações atômicas
	pipe := r.client.Pipeline()
	pipe.Set(r.ctx, key, data, 0) // Sem expiração

	// Adicionar à lista global de tags
	pipe.SAdd(r.ctx, tagListKey, strconv.Itoa(tag.ID))

	// Adicionar ao índice por PLC
	plcTagsKey := fmt.Sprintf("%s%d", tagsByPLCPrefix, tag.PLCID)
	pipe.SAdd(r.ctx, plcTagsKey, strconv.Itoa(tag.ID))

	// Adicionar ao índice por nome
	nameTagsKey := fmt.Sprintf("%s%s", tagsByNamePrefix, tag.Name)
	pipe.SAdd(r.ctx, nameTagsKey, strconv.Itoa(tag.ID))

	_, err = pipe.Exec(r.ctx)
	if err != nil {
		return 0, err
	}

	return tag.ID, nil
}

// Update atualiza uma tag existente no Redis
func (r *PLCTagRedisRepository) Update(tag domain.PLCTag) error {
	if tag.ID <= 0 {
		return fmt.Errorf("ID de tag inválido para atualização no Redis")
	}

	// Verificar se a tag existe e buscar dados antigos para comparação
	oldTagKey := fmt.Sprintf("%s%d", tagKeyPrefix, tag.ID)
	oldTagData, err := r.client.Get(r.ctx, oldTagKey).Result()
	if err != nil {
		if err == redis.Nil {
			return domain.ErrPLCTagNotFound
		}
		return err
	}

	var oldTag domain.PLCTag
	if err := json.Unmarshal([]byte(oldTagData), &oldTag); err != nil {
		return err
	}

	// Serializar nova versão da tag
	tag.UpdatedAt = time.Now()
	data, err := json.Marshal(tag)
	if err != nil {
		return err
	}

	pipe := r.client.Pipeline()

	// Atualizar a tag
	pipe.Set(r.ctx, oldTagKey, data, 0)

	// Se o PLC mudou, atualizar os índices
	if oldTag.PLCID != tag.PLCID {
		oldPLCTagsKey := fmt.Sprintf("%s%d", tagsByPLCPrefix, oldTag.PLCID)
		newPLCTagsKey := fmt.Sprintf("%s%d", tagsByPLCPrefix, tag.PLCID)

		pipe.SRem(r.ctx, oldPLCTagsKey, strconv.Itoa(tag.ID))
		pipe.SAdd(r.ctx, newPLCTagsKey, strconv.Itoa(tag.ID))
	}

	// Se o nome mudou, atualizar os índices
	if oldTag.Name != tag.Name {
		oldNameTagsKey := fmt.Sprintf("%s%s", tagsByNamePrefix, oldTag.Name)
		newNameTagsKey := fmt.Sprintf("%s%s", tagsByNamePrefix, tag.Name)

		pipe.SRem(r.ctx, oldNameTagsKey, strconv.Itoa(tag.ID))
		pipe.SAdd(r.ctx, newNameTagsKey, strconv.Itoa(tag.ID))
	}

	_, err = pipe.Exec(r.ctx)
	return err
}

// Delete remove uma tag do Redis
func (r *PLCTagRedisRepository) Delete(id int) error {
	// Buscar a tag para obter informações antes de excluir
	tag, err := r.GetByID(id)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("%s%d", tagKeyPrefix, id)
	plcTagsKey := fmt.Sprintf("%s%d", tagsByPLCPrefix, tag.PLCID)
	nameTagsKey := fmt.Sprintf("%s%s", tagsByNamePrefix, tag.Name)

	// Remover usando pipeline
	pipe := r.client.Pipeline()
	pipe.Del(r.ctx, key)
	pipe.SRem(r.ctx, tagListKey, strconv.Itoa(id))
	pipe.SRem(r.ctx, plcTagsKey, strconv.Itoa(id))
	pipe.SRem(r.ctx, nameTagsKey, strconv.Itoa(id))

	// Também remover qualquer valor armazenado
	valueKey := fmt.Sprintf("%s%d", tagValueKeyPrefix, id)
	pipe.Del(r.ctx, valueKey)

	_, err = pipe.Exec(r.ctx)
	return err
}
