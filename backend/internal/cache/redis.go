package cache

import (
	"app_padrao/internal/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

type RedisCache struct {
	client *redis.Client
	ctx    context.Context
}

func NewRedisCache(addr, password string, db int) (*RedisCache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx := context.Background()

	// Teste a conexão
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Erro ao conectar ao Redis: %v", err)
		return nil, err
	}

	log.Printf("Conexão com Redis estabelecida com sucesso: %s", addr)

	return &RedisCache{
		client: client,
		ctx:    ctx,
	}, nil
}

// GetRedisClient retorna o cliente Redis interno para uso por outros repositórios
func (r *RedisCache) GetRedisClient() *redis.Client {
	return r.client
}

// SetTagValue armazena o valor de uma tag no Redis
func (r *RedisCache) SetTagValue(plcID, tagID int, value interface{}) error {
	key := fmt.Sprintf("plc:%d:tag:%d", plcID, tagID)

	tagValue := map[string]interface{}{
		"value":     value,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(tagValue)
	if err != nil {
		log.Printf("Erro ao serializar valor para Redis: %v", err)
		return err
	}

	err = r.client.Set(r.ctx, key, jsonData, 24*time.Hour).Err()
	if err != nil {
		log.Printf("Erro ao armazenar valor no Redis: %v", err)
		return err
	}

	log.Printf("Valor armazenado no Redis com sucesso: plc:%d:tag:%d = %v", plcID, tagID, value)
	return nil
}

// GetTagValue recupera o valor de uma tag do Redis
func (r *RedisCache) GetTagValue(plcID, tagID int) (*domain.TagValue, error) {
	key := fmt.Sprintf("plc:%d:tag:%d", plcID, tagID)

	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			log.Printf("Valor não encontrado no Redis: %s", key)
			return nil, nil // Valor não encontrado, não é erro
		}
		log.Printf("Erro ao ler do Redis: %v", err)
		return nil, err
	}

	var valueMap map[string]interface{}
	if err := json.Unmarshal([]byte(data), &valueMap); err != nil {
		log.Printf("Erro ao desserializar valor do Redis: %v", err)
		return nil, err
	}

	// Parse timestamp
	timestampStr, ok := valueMap["timestamp"].(string)
	if !ok {
		log.Printf("Formato de timestamp inválido no Redis")
		return nil, errors.New("formato de timestamp inválido")
	}

	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		log.Printf("Erro ao converter timestamp: %v", err)
		return nil, err
	}

	log.Printf("Valor lido do Redis com sucesso: plc:%d:tag:%d = %v", plcID, tagID, valueMap["value"])
	return &domain.TagValue{
		PLCID:     plcID,
		TagID:     tagID,
		Value:     valueMap["value"],
		Timestamp: timestamp,
	}, nil
}

// BatchSetTagValues define vários valores de tag de uma vez só
func (r *RedisCache) BatchSetTagValues(values []domain.TagValue) error {
	if len(values) == 0 {
		return nil // Nada para fazer
	}

	pipe := r.client.Pipeline()

	for _, tagValue := range values {
		key := fmt.Sprintf("plc:%d:tag:%d", tagValue.PLCID, tagValue.TagID)

		data := map[string]interface{}{
			"value":     tagValue.Value,
			"timestamp": tagValue.Timestamp.Format(time.RFC3339),
		}

		jsonData, err := json.Marshal(data)
		if err != nil {
			log.Printf("Erro ao serializar valor para batch: %v", err)
			continue
		}

		pipe.Set(r.ctx, key, jsonData, 24*time.Hour)
	}

	_, err := pipe.Exec(r.ctx)
	if err != nil {
		log.Printf("Erro ao executar batch de valores: %v", err)
		return err
	}

	log.Printf("Batch de %d valores armazenados com sucesso", len(values))
	return nil
}

// GetMultipleTagValues busca múltiplos valores de tag de uma vez
func (r *RedisCache) GetMultipleTagValues(queries []struct{ PLCID, TagID int }) ([]domain.TagValue, error) {
	if len(queries) == 0 {
		return []domain.TagValue{}, nil
	}

	pipe := r.client.Pipeline()
	cmds := make(map[string]*redis.StringCmd)

	for _, query := range queries {
		key := fmt.Sprintf("plc:%d:tag:%d", query.PLCID, query.TagID)
		cmds[key] = pipe.Get(r.ctx, key)
	}

	_, err := pipe.Exec(r.ctx)
	if err != nil && err != redis.Nil {
		log.Printf("Erro ao executar pipeline de leitura: %v", err)
		return nil, err
	}

	var results []domain.TagValue

	for key, cmd := range cmds {
		data, err := cmd.Result()
		if err == redis.Nil {
			continue // Chave não encontrada
		}
		if err != nil {
			log.Printf("Erro ao ler chave %s: %v", key, err)
			continue
		}

		var valueMap map[string]interface{}
		if err := json.Unmarshal([]byte(data), &valueMap); err != nil {
			log.Printf("Erro ao desserializar valor: %v", err)
			continue
		}

		// Parse timestamp
		timestampStr, ok := valueMap["timestamp"].(string)
		if !ok {
			log.Printf("Formato de timestamp inválido para chave %s", key)
			continue
		}

		timestamp, err := time.Parse(time.RFC3339, timestampStr)
		if err != nil {
			log.Printf("Erro ao converter timestamp: %v", err)
			continue
		}

		// Extrair PLCID e TagID da chave
		var plcID, tagID int
		fmt.Sscanf(key, "plc:%d:tag:%d", &plcID, &tagID)

		results = append(results, domain.TagValue{
			PLCID:     plcID,
			TagID:     tagID,
			Value:     valueMap["value"],
			Timestamp: timestamp,
		})
	}

	return results, nil
}

// VerifyRedisHealth verifica a saúde do Redis
func (r *RedisCache) VerifyRedisHealth() error {
	// Tenta salvar um valor de teste
	testKey := "plc:test:health"
	testValue := map[string]interface{}{
		"value":     "teste_saudavel",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	log.Printf("Verificando saúde do Redis com key: %s", testKey)

	// Serializar e salvar
	jsonData, err := json.Marshal(testValue)
	if err != nil {
		log.Printf("Erro ao serializar teste de saúde: %v", err)
		return err
	}

	err = r.client.Set(r.ctx, testKey, jsonData, 5*time.Minute).Err()
	if err != nil {
		log.Printf("Erro ao salvar teste de saúde no Redis: %v", err)
		return err
	}

	// Buscar o valor de volta
	data, err := r.client.Get(r.ctx, testKey).Result()
	if err != nil {
		log.Printf("Erro ao recuperar teste de saúde do Redis: %v", err)
		return err
	}

	var retrievedValue map[string]interface{}
	if err := json.Unmarshal([]byte(data), &retrievedValue); err != nil {
		log.Printf("Erro ao desserializar teste de saúde: %v", err)
		return err
	}

	log.Printf("Verificação de saúde do Redis concluída com sucesso")
	return nil
}
