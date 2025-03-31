// pkg/plc/clientresilient.go
package plc

import (
	"app_padrao/pkg/resilience"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"
)

// RetryOptions define opções para retry
type RetryOptions struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	BackoffFactor  float64
}

// DefaultRetryOptions retorna opções padrão para retry
func DefaultRetryOptions() RetryOptions {
	return RetryOptions{
		MaxRetries:     3,
		InitialBackoff: 100 * time.Millisecond,
		MaxBackoff:     5 * time.Second,
		BackoffFactor:  2.0,
	}
}

// ResilientClient é um wrapper em torno do cliente PLC com retry e circuit breaker
type ResilientClient struct {
	client         *Client
	circuitBreaker *resilience.CircuitBreaker
	retryOptions   RetryOptions
}

// NewResilientClient cria um novo cliente resiliente
func NewResilientClient(client *Client) *ResilientClient {
	return &ResilientClient{
		client:         client,
		circuitBreaker: resilience.NewCircuitBreaker(5, 1*time.Minute),
		retryOptions:   DefaultRetryOptions(),
	}
}

// ReadTagWithRetry lê uma tag com retry e circuit breaker
func (rc *ResilientClient) ReadTagWithRetry(dbNumber int, byteOffset int, dataType string, bitOffset int) (interface{}, error) {
	// Verificar se o circuit breaker está aberto
	if rc.circuitBreaker.IsOpen() {
		return nil, errors.New("circuit breaker is open")
	}

	var result interface{}
	var err error

	// Inicializar o gerador de números aleatórios para jitter
	rand.Seed(time.Now().UnixNano())

	// Tentar operação com retry
	backoff := rc.retryOptions.InitialBackoff
	for attempt := 0; attempt <= rc.retryOptions.MaxRetries; attempt++ {
		result, err = rc.client.ReadTag(dbNumber, byteOffset, dataType, bitOffset)

		if err == nil {
			// Operação bem-sucedida
			rc.circuitBreaker.RecordSuccess()
			return result, nil
		}

		// Verificar se é um erro que justifica retry
		if !isNetworkError(err) {
			rc.circuitBreaker.RecordFailure()
			return nil, err
		}

		// Calcular tempo de espera para o próximo retry
		if attempt < rc.retryOptions.MaxRetries {
			// Usar backoff exponencial com jitter
			jitter := time.Duration(float64(backoff) * (0.5 + 0.5*rand.Float64()))
			sleepTime := backoff + jitter

			log.Printf("Erro retryable na tentativa %d/%d: %v. Tentando novamente em %v...",
				attempt+1, rc.retryOptions.MaxRetries, err, sleepTime)

			time.Sleep(sleepTime)

			// Aumentar backoff para próxima tentativa
			backoff = time.Duration(float64(backoff) * rc.retryOptions.BackoffFactor)
			if backoff > rc.retryOptions.MaxBackoff {
				backoff = rc.retryOptions.MaxBackoff
			}
		} else {
			// Última tentativa falhou
			rc.circuitBreaker.RecordFailure()
		}
	}

	// Todas as tentativas falharam
	return nil, fmt.Errorf("todas as %d tentativas falharam, último erro: %w",
		rc.retryOptions.MaxRetries+1, err)
}

// WriteTagWithRetry escreve uma tag com retry e circuit breaker
func (rc *ResilientClient) WriteTagWithRetry(dbNumber int, byteOffset int, dataType string, bitOffset int, value interface{}) error {
	// Verificar se o circuit breaker está aberto
	if rc.circuitBreaker.IsOpen() {
		return errors.New("circuit breaker is open")
	}

	var err error

	// Inicializar o gerador de números aleatórios para jitter
	rand.Seed(time.Now().UnixNano())

	// Tentar operação com retry
	backoff := rc.retryOptions.InitialBackoff
	for attempt := 0; attempt <= rc.retryOptions.MaxRetries; attempt++ {
		err = rc.client.WriteTag(dbNumber, byteOffset, dataType, bitOffset, value)

		if err == nil {
			// Operação bem-sucedida
			rc.circuitBreaker.RecordSuccess()
			return nil
		}

		// Verificar se é um erro que justifica retry
		if !isNetworkError(err) {
			rc.circuitBreaker.RecordFailure()
			return err
		}

		// Calcular tempo de espera para o próximo retry
		if attempt < rc.retryOptions.MaxRetries {
			// Usar backoff exponencial com jitter
			jitter := time.Duration(float64(backoff) * (0.5 + 0.5*rand.Float64()))
			sleepTime := backoff + jitter

			log.Printf("Erro retryable na tentativa %d/%d: %v. Tentando novamente em %v...",
				attempt+1, rc.retryOptions.MaxRetries, err, sleepTime)

			time.Sleep(sleepTime)

			// Aumentar backoff para próxima tentativa
			backoff = time.Duration(float64(backoff) * rc.retryOptions.BackoffFactor)
			if backoff > rc.retryOptions.MaxBackoff {
				backoff = rc.retryOptions.MaxBackoff
			}
		} else {
			// Última tentativa falhou
			rc.circuitBreaker.RecordFailure()
		}
	}

	// Todas as tentativas falharam
	return fmt.Errorf("todas as %d tentativas falharam, último erro: %w",
		rc.retryOptions.MaxRetries+1, err)
}
