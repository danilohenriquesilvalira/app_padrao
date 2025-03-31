// internal/cache/redis.go
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

// Erros específicos para o cache
var (
	ErrRedisNotConnected = errors.New("conexão com Redis não estabelecida")
	ErrKeyNotFound       = errors.New("chave não encontrada no Redis")
	ErrInvalidFormat     = errors.New("formato de dados inválido")
)

// RedisCache implementa a interface PLCCache usando Redis
type RedisCache struct {
	client         *redis.Client
	ctx            context.Context
	keyPrefix      string
	defaultTTL     time.Duration
	connRetryCount int
	connRetryDelay time.Duration
}

// RedisConfig contém configurações para o cache Redis
type RedisConfig struct {
	KeyPrefix      string
	DefaultTTL     time.Duration
	ConnRetryCount int
	ConnRetryDelay time.Duration
}

// NewRedisCache cria uma nova instância do cache Redis
func NewRedisCache(addr, password string, db int) (*RedisCache, error) {
	// Configuração padrão
	config := RedisConfig{
		KeyPrefix:      "plc:",
		DefaultTTL:     24 * time.Hour,
		ConnRetryCount: 3,
		ConnRetryDelay: 2 * time.Second,
	}

	return NewRedisCacheWithConfig(addr, password, db, config)
}

// NewRedisCacheWithConfig cria uma nova instância do cache Redis com configurações personalizadas
func NewRedisCacheWithConfig(addr, password string, db int, config RedisConfig) (*RedisCache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
		MinIdleConns: 2,
	})

	ctx := context.Background()

	// Teste a conexão com retry
	var err error
	for i := 0; i < config.ConnRetryCount; i++ {
		err = client.Ping(ctx).Err()
		if err == nil {
			break
		}

		log.Printf("Tentativa %d/%d - Erro ao conectar ao Redis (%s): %v. Tentando novamente...",
			i+1, config.ConnRetryCount, addr, err)

		if i < config.ConnRetryCount-1 {
			time.Sleep(config.ConnRetryDelay)
		}
	}

	if err != nil {
		log.Printf("Falha ao conectar ao Redis após %d tentativas: %v", config.ConnRetryCount, err)
		return nil, fmt.Errorf("%w: %v", ErrRedisNotConnected, err)
	}

	log.Printf("Conexão com Redis estabelecida com sucesso: %s", addr)

	cache := &RedisCache{
		client:         client,
		ctx:            ctx,
		keyPrefix:      config.KeyPrefix,
		defaultTTL:     config.DefaultTTL,
		connRetryCount: config.ConnRetryCount,
		connRetryDelay: config.ConnRetryDelay,
	}

	return cache, nil
}

// GetRedisClient retorna o cliente Redis interno para uso por outros repositórios
func (r *RedisCache) GetRedisClient() *redis.Client {
	return r.client
}

// formatKey formata uma chave com o prefixo padrão
func (r *RedisCache) formatKey(plcID, tagID int) string {
	return fmt.Sprintf("%splc:%d:tag:%d", r.keyPrefix, plcID, tagID)
}

// SetTagValue armazena o valor de uma tag no Redis
func (r *RedisCache) SetTagValue(plcID, tagID int, value interface{}) error {
	key := r.formatKey(plcID, tagID)

	// Verificar valor nulo
	if value == nil {
		log.Printf("Aviso: Tentativa de armazenar valor nulo para plc:%d:tag:%d", plcID, tagID)
	}

	tagValue := map[string]interface{}{
		"value":     value,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(tagValue)
	if err != nil {
		log.Printf("Erro ao serializar valor para Redis: %v", err)
		return fmt.Errorf("erro ao serializar valor: %w", err)
	}

	// Tentar set com retry em caso de erro
	var setErr error
	for i := 0; i < r.connRetryCount; i++ {
		setErr = r.client.Set(r.ctx, key, jsonData, r.defaultTTL).Err()
		if setErr == nil {
			break
		}

		log.Printf("Tentativa %d/%d - Erro ao armazenar valor no Redis: %v. Tentando novamente...",
			i+1, r.connRetryCount, setErr)

		if i < r.connRetryCount-1 {
			time.Sleep(r.connRetryDelay)
		}
	}

	if setErr != nil {
		return fmt.Errorf("erro ao armazenar valor no Redis após %d tentativas: %w",
			r.connRetryCount, setErr)
	}

	if r.client.TTL(r.ctx, key).Val() < 0 {
		// Se por algum motivo não tiver TTL, definir explicitamente
		r.client.Expire(r.ctx, key, r.defaultTTL)
	}

	return nil
}

// GetTagValue recupera o valor de uma tag do Redis
func (r *RedisCache) GetTagValue(plcID, tagID int) (*domain.TagValue, error) {
	key := r.formatKey(plcID, tagID)

	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			// Chave não encontrada, não é erro
			return nil, nil
		}
		return nil, fmt.Errorf("erro ao ler do Redis: %w", err)
	}

	var valueMap map[string]interface{}
	if err := json.Unmarshal([]byte(data), &valueMap); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidFormat, err)
	}

	// Parse timestamp
	timestampStr, ok := valueMap["timestamp"].(string)
	if !ok {
		return nil, ErrInvalidFormat
	}

	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		return nil, fmt.Errorf("erro ao converter timestamp: %w", err)
	}

	// Renovar TTL quando o valor é lido (opcional)
	r.client.Expire(r.ctx, key, r.defaultTTL)

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
	errors := make([]error, 0)

	for _, tagValue := range values {
		key := r.formatKey(tagValue.PLCID, tagValue.TagID)

		data := map[string]interface{}{
			"value":     tagValue.Value,
			"timestamp": tagValue.Timestamp.Format(time.RFC3339),
		}

		jsonData, err := json.Marshal(data)
		if err != nil {
			errors = append(errors, fmt.Errorf("erro ao serializar tag %d: %w", tagValue.TagID, err))
			continue
		}

		pipe.Set(r.ctx, key, jsonData, r.defaultTTL)
	}

	// Executar as operações em pipeline
	_, err := pipe.Exec(r.ctx)
	if err != nil {
		errors = append(errors, fmt.Errorf("erro ao executar pipeline: %w", err))
	}

	// Se tivemos erros, retornar um erro combinado
	if len(errors) > 0 {
		errMsg := fmt.Sprintf("%d erros ao processar o batch", len(errors))
		if len(errors) <= 3 {
			// Incluir detalhes apenas para poucos erros para não sobrecarregar os logs
			errMsg = fmt.Sprintf("Erros ao processar batch: %v", errors)
		}
		return fmt.Errorf(errMsg)
	}

	return nil
}

// GetMultipleTagValues busca múltiplos valores de tag de uma vez
func (r *RedisCache) GetMultipleTagValues(queries []struct{ PLCID, TagID int }) ([]domain.TagValue, error) {
	if len(queries) == 0 {
		return []domain.TagValue{}, nil
	}

	pipe := r.client.Pipeline()
	cmds := make(map[string]*redis.StringCmd)
	queryMap := make(map[string]struct{ PLCID, TagID int })

	for _, query := range queries {
		key := r.formatKey(query.PLCID, query.TagID)
		cmds[key] = pipe.Get(r.ctx, key)
		queryMap[key] = query
	}

	_, err := pipe.Exec(r.ctx)
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("erro ao executar pipeline de leitura: %w", err)
	}

	var results []domain.TagValue
	var parseErrors []error

	for key, cmd := range cmds {
		data, err := cmd.Result()
		if err == redis.Nil {
			continue // Chave não encontrada
		}
		if err != nil {
			parseErrors = append(parseErrors, fmt.Errorf("erro ao ler chave %s: %w", key, err))
			continue
		}

		var valueMap map[string]interface{}
		if err := json.Unmarshal([]byte(data), &valueMap); err != nil {
			parseErrors = append(parseErrors, fmt.Errorf("erro ao desserializar valor para %s: %w", key, err))
			continue
		}

		// Parse timestamp
		timestampStr, ok := valueMap["timestamp"].(string)
		if !ok {
			parseErrors = append(parseErrors, fmt.Errorf("formato de timestamp inválido para chave %s", key))
			continue
		}

		timestamp, err := time.Parse(time.RFC3339, timestampStr)
		if err != nil {
			parseErrors = append(parseErrors, fmt.Errorf("erro ao converter timestamp para %s: %w", key, err))
			continue
		}

		// Recuperar informações de PLCID e TagID
		query, ok := queryMap[key]
		if !ok {
			parseErrors = append(parseErrors, fmt.Errorf("informações de consulta não encontradas para chave %s", key))
			continue
		}

		results = append(results, domain.TagValue{
			PLCID:     query.PLCID,
			TagID:     query.TagID,
			Value:     valueMap["value"],
			Timestamp: timestamp,
		})

		// Renovar TTL (opcional)
		pipe.Expire(r.ctx, key, r.defaultTTL)
	}

	// Executar as operações de renovação de TTL
	pipe.Exec(r.ctx)

	// Logar erros de parsing, mas não falhar a operação
	if len(parseErrors) > 0 {
		log.Printf("Erros ao processar múltiplos valores: %v", parseErrors)
	}

	return results, nil
}

// VerifyRedisHealth verifica a saúde do Redis
func (r *RedisCache) VerifyRedisHealth() error {
	// Tenta salvar um valor de teste
	testKey := fmt.Sprintf("%stest:health", r.keyPrefix)
	testValue := map[string]interface{}{
		"value":     "teste_saudavel",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// Serializar e salvar
	jsonData, err := json.Marshal(testValue)
	if err != nil {
		return fmt.Errorf("erro ao serializar teste de saúde: %w", err)
	}

	// Verificar conexão com ping
	if err := r.client.Ping(r.ctx).Err(); err != nil {
		return fmt.Errorf("ping falhou: %w", err)
	}

	// Testar operações de escrita e leitura
	err = r.client.Set(r.ctx, testKey, jsonData, 5*time.Minute).Err()
	if err != nil {
		return fmt.Errorf("erro ao salvar teste de saúde no Redis: %w", err)
	}

	// Buscar o valor de volta
	data, err := r.client.Get(r.ctx, testKey).Result()
	if err != nil {
		return fmt.Errorf("erro ao recuperar teste de saúde do Redis: %w", err)
	}

	var retrievedValue map[string]interface{}
	if err := json.Unmarshal([]byte(data), &retrievedValue); err != nil {
		return fmt.Errorf("erro ao desserializar teste de saúde: %w", err)
	}

	// Verificar memória disponível (opcional)
	info, err := r.client.Info(r.ctx, "memory").Result()
	if err == nil {
		log.Printf("Informações de memória do Redis: %s", info)
	}

	// Testar deletar chave
	if err := r.client.Del(r.ctx, testKey).Err(); err != nil {
		return fmt.Errorf("erro ao remover chave de teste: %w", err)
	}

	return nil
}

// Close fecha a conexão com o Redis
func (r *RedisCache) Close() error {
	return r.client.Close()
}
