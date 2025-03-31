// internal/metrics/metrics.go
package metrics

import (
	"sync"
	"time"
)

// MetricsCollector coleta métricas de operação do sistema
type MetricsCollector struct {
	mutex      sync.RWMutex
	counters   map[string]int64
	gauges     map[string]float64
	histograms map[string][]float64
	startTime  time.Time
}

// NewMetricsCollector cria um novo coletor de métricas
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		counters:   make(map[string]int64),
		gauges:     make(map[string]float64),
		histograms: make(map[string][]float64),
		startTime:  time.Now(),
	}
}

// IncrementCounter incrementa um contador
func (mc *MetricsCollector) IncrementCounter(name string, value int64) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	mc.counters[name] += value
}

// SetGauge define o valor de um gauge
func (mc *MetricsCollector) SetGauge(name string, value float64) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	mc.gauges[name] = value
}

// RecordHistogram adiciona um valor a um histograma
func (mc *MetricsCollector) RecordHistogram(name string, value float64) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	mc.histograms[name] = append(mc.histograms[name], value)
	// Limitar tamanho para evitar uso excessivo de memória
	if len(mc.histograms[name]) > 1000 {
		mc.histograms[name] = mc.histograms[name][1:]
	}
}

// GetAllMetrics retorna todas as métricas coletadas
func (mc *MetricsCollector) GetAllMetrics() map[string]interface{} {
	mc.mutex.RLock()
	defer mc.mutex.RUnlock()

	result := make(map[string]interface{})

	// Copiar contadores
	counters := make(map[string]int64)
	for k, v := range mc.counters {
		counters[k] = v
	}
	result["counters"] = counters

	// Copiar gauges
	gauges := make(map[string]float64)
	for k, v := range mc.gauges {
		gauges[k] = v
	}
	result["gauges"] = gauges

	// Calcular estatísticas dos histogramas
	histogramStats := make(map[string]map[string]float64)
	for name, values := range mc.histograms {
		if len(values) == 0 {
			continue
		}

		stats := make(map[string]float64)
		// Calcular média
		sum := 0.0
		for _, v := range values {
			sum += v
		}
		stats["avg"] = sum / float64(len(values))

		histogramStats[name] = stats
	}
	result["histograms"] = histogramStats

	// Adicionar tempo de atividade
	result["uptime_seconds"] = time.Since(mc.startTime).Seconds()

	return result
}
