package config

import "strconv"

// PLCConfig contém configurações para o sistema de monitoramento de PLCs
type PLCConfig struct {
	// Configurações de Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	// Configurações de monitoramento
	MonitoringInterval    int  // Intervalo em segundos para verificar PLCs ativos
	TagBatchSize          int  // Tamanho máximo de lote para leitura de tags
	EnableSyncService     bool // Habilitar serviço de sincronização
	SyncInterval          int  // Intervalo em minutos para sincronização
	ConnectionTimeout     int  // Timeout em segundos para conexão com PLC
	EnableDetailedLogging bool // Habilitar logs detalhados
}

// LoadPLCConfig carrega configurações para o sistema de PLCs
func LoadPLCConfig() PLCConfig {
	return PLCConfig{
		// Configurações padrão
		RedisHost:             getEnv("REDIS_HOST", "localhost"),
		RedisPort:             getEnv("REDIS_PORT", "6379"),
		RedisPassword:         getEnv("REDIS_PASSWORD", ""),
		RedisDB:               getEnvAsInt("REDIS_DB", 0),
		MonitoringInterval:    getEnvAsInt("PLC_MONITORING_INTERVAL", 5),
		TagBatchSize:          getEnvAsInt("PLC_TAG_BATCH_SIZE", 100),
		EnableSyncService:     getEnvAsBool("PLC_ENABLE_SYNC", true),
		SyncInterval:          getEnvAsInt("PLC_SYNC_INTERVAL", 5),
		ConnectionTimeout:     getEnvAsInt("PLC_CONNECTION_TIMEOUT", 10),
		EnableDetailedLogging: getEnvAsBool("PLC_DETAILED_LOGGING", false),
	}
}

// Helpers para parsing de variáveis de ambiente
func getEnvAsInt(name string, defaultVal int) int {
	valueStr := getEnv(name, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultVal
}

func getEnvAsBool(name string, defaultVal bool) bool {
	valueStr := getEnv(name, "")
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultVal
}
