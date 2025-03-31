// pkg/resilience/circuitbreaker.go
package resilience

import (
	"sync"
	"time"
)

// CircuitBreaker evita chamadas repetidas a um serviço com falha
type CircuitBreaker struct {
	mutex     sync.RWMutex
	failCount int
	lastFail  time.Time
	threshold int
	cooldown  time.Duration
	isOpen    bool
}

// NewCircuitBreaker cria um novo circuit breaker
func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		threshold: threshold,
		cooldown:  cooldown,
	}
}

// IsOpen verifica se o circuit breaker está aberto (impedindo chamadas)
func (cb *CircuitBreaker) IsOpen() bool {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()

	// Se já estiver aberto, verificar se passou o tempo de cooldown
	if cb.isOpen {
		if time.Since(cb.lastFail) > cb.cooldown {
			// Podemos tentar novamente, fechar o circuito
			cb.mutex.RUnlock()
			cb.mutex.Lock()
			cb.isOpen = false
			cb.failCount = 0
			cb.mutex.Unlock()
			cb.mutex.RLock()
			return false
		}
		return true
	}
	return false
}

// RecordSuccess registra uma chamada bem-sucedida
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()
	cb.failCount = 0
	cb.isOpen = false
}

// RecordFailure registra uma falha
func (cb *CircuitBreaker) RecordFailure() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()
	cb.failCount++
	cb.lastFail = time.Now()

	if cb.failCount >= cb.threshold {
		cb.isOpen = true
	}
}
