// pkg/resilience/ratelimiter.go
package resilience

import (
	"sync"
	"time"
)

// RateLimiter limita operações por tempo
type RateLimiter struct {
	mutex      sync.Mutex
	limit      int           // Número máximo de operações
	interval   time.Duration // Intervalo de tempo
	operations map[string][]time.Time
}

// NewRateLimiter cria um novo limitador de taxa
func NewRateLimiter(limit int, interval time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:      limit,
		interval:   interval,
		operations: make(map[string][]time.Time),
	}
}

// AllowOperation verifica se uma operação é permitida
func (rl *RateLimiter) AllowOperation(key string) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.interval)

	// Limpar operações antigas
	if times, exists := rl.operations[key]; exists {
		newTimes := make([]time.Time, 0, len(times))
		for _, t := range times {
			if t.After(cutoff) {
				newTimes = append(newTimes, t)
			}
		}
		rl.operations[key] = newTimes

		// Verificar se atingiu o limite
		if len(newTimes) >= rl.limit {
			return false
		}
	}

	// Registrar nova operação
	if _, exists := rl.operations[key]; !exists {
		rl.operations[key] = make([]time.Time, 0)
	}
	rl.operations[key] = append(rl.operations[key], now)

	return true
}

// ResetKey limpa o contador para uma chave
func (rl *RateLimiter) ResetKey(key string) {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	delete(rl.operations, key)
}
