// internal/health/healthcheck.go
package health

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// Status representa o status de saúde de um componente
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusDegraded  Status = "degraded"
	StatusUnhealthy Status = "unhealthy"
)

// ComponentHealth representa o status de saúde de um componente
type ComponentHealth struct {
	Status      Status    `json:"status"`
	Details     string    `json:"details"`
	LastChecked time.Time `json:"last_checked"`
}

// HealthCheck verifica a saúde de diferentes componentes do sistema
type HealthCheck struct {
	mutex      sync.RWMutex
	components map[string]ComponentHealth
}

// NewHealthCheck cria um novo verificador de saúde
func NewHealthCheck() *HealthCheck {
	return &HealthCheck{
		components: make(map[string]ComponentHealth),
	}
}

// CheckPostgres verifica a saúde da conexão PostgreSQL
func (hc *HealthCheck) CheckPostgres(db *sql.DB) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := db.PingContext(ctx)

	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	if err != nil {
		hc.components["postgres"] = ComponentHealth{
			Status:      StatusUnhealthy,
			Details:     err.Error(),
			LastChecked: time.Now(),
		}
	} else {
		hc.components["postgres"] = ComponentHealth{
			Status:      StatusHealthy,
			Details:     "Connection successful",
			LastChecked: time.Now(),
		}
	}
}

// CheckRedis verifica a saúde da conexão Redis
func (hc *HealthCheck) CheckRedis(client *redis.Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	status := StatusHealthy
	details := "Connection successful"

	pong, err := client.Ping(ctx).Result()
	if err != nil {
		status = StatusUnhealthy
		details = err.Error()
	} else if pong != "PONG" {
		status = StatusDegraded
		details = "Unexpected response from Redis"
	}

	hc.mutex.Lock()
	defer hc.mutex.Unlock()

	hc.components["redis"] = ComponentHealth{
		Status:      status,
		Details:     details,
		LastChecked: time.Now(),
	}
}

// GetHealth retorna o status de saúde de todos os componentes
func (hc *HealthCheck) GetHealth() map[string]ComponentHealth {
	hc.mutex.RLock()
	defer hc.mutex.RUnlock()

	// Copiar o mapa para evitar problemas de concorrência
	result := make(map[string]ComponentHealth)
	for k, v := range hc.components {
		result[k] = v
	}

	return result
}

// GetOverallStatus retorna o status geral do sistema
func (hc *HealthCheck) GetOverallStatus() Status {
	hc.mutex.RLock()
	defer hc.mutex.RUnlock()

	hasUnhealthy := false
	hasDegraded := false

	for _, health := range hc.components {
		if health.Status == StatusUnhealthy {
			hasUnhealthy = true
		} else if health.Status == StatusDegraded {
			hasDegraded = true
		}
	}

	if hasUnhealthy {
		return StatusUnhealthy
	} else if hasDegraded {
		return StatusDegraded
	}

	return StatusHealthy
}
