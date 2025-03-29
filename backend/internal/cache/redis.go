package cache

import (
	"app_padrao/internal/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		return nil, err
	}

	return &RedisCache{
		client: client,
		ctx:    ctx,
	}, nil
}

// Implementação da interface domain.PLCCache

func (r *RedisCache) SetTagValue(plcID, tagID int, value interface{}) error {
	key := fmt.Sprintf("plc:%d:tag:%d", plcID, tagID)

	tagValue := map[string]interface{}{
		"value":     value,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(tagValue)
	if err != nil {
		return err
	}

	return r.client.Set(r.ctx, key, jsonData, 24*time.Hour).Err()
}

func (r *RedisCache) GetTagValue(plcID, tagID int) (*domain.TagValue, error) {
	key := fmt.Sprintf("plc:%d:tag:%d", plcID, tagID)

	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Valor não encontrado, não é erro
		}
		return nil, err
	}

	var valueMap map[string]interface{}
	if err := json.Unmarshal([]byte(data), &valueMap); err != nil {
		return nil, err
	}

	// Parse timestamp
	timestampStr, ok := valueMap["timestamp"].(string)
	if !ok {
		return nil, errors.New("formato de timestamp inválido")
	}

	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		return nil, err
	}

	return &domain.TagValue{
		PLCID:     plcID,
		TagID:     tagID,
		Value:     valueMap["value"],
		Timestamp: timestamp,
	}, nil
}
