// config/config.go
package config

import (
	"app_padrao/pkg/database"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Definição de tipos de configuração
type Config struct {
	Server   ServerConfig
	DB       database.Config
	JWT      JWTConfig
	PLC      PLCConfig // Agora PLCConfig está definido no arquivo
	Redis    RedisConfig
	Security SecurityConfig
}

// PLCConfig contém configurações para o sistema de monitoramento de PLCs
type PLCConfig struct {
	// Configurações de Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	// Configurações de monitoramento
	MonitoringEnabled     bool // Habilitar serviço de monitoramento
	MonitoringInterval    int  // Intervalo em segundos para verificar PLCs ativos
	TagBatchSize          int  // Tamanho máximo de lote para leitura de tags
	EnableSyncService     bool // Habilitar serviço de sincronização
	SyncInterval          int  // Intervalo em minutos para sincronização
	ConnectionTimeout     int  // Timeout em segundos para conexão com PLC
	EnableDebugLogging    bool // Habilitar logs detalhados
	EnableDetailedLogging bool // Habilitar logs muito detalhados
}

type ServerConfig struct {
	Port               string
	Host               string
	ReadTimeout        int
	WriteTimeout       int
	MaxHeaderBytes     int
	TrustedProxies     []string
	EnableCORS         bool
	AllowedOrigins     []string
	CorsAllowedMethods []string
}

type JWTConfig struct {
	SecretKey        string
	ExpirationHours  int
	Issuer           string
	SkipVerification bool // Apenas para desenvolvimento
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
	Enabled  bool
}

type SecurityConfig struct {
	PasswordMinLength int
	BcryptCost        int
	EnableCSRF        bool
	CSRFTokenExpiry   int // em minutos
}

// LoadPLCConfig carrega configurações para o sistema de PLCs
func LoadPLCConfig() PLCConfig {
	return PLCConfig{
		// Configurações padrão
		RedisHost:             getEnv("REDIS_HOST", "localhost"),
		RedisPort:             getEnv("REDIS_PORT", "6379"),
		RedisPassword:         getEnv("REDIS_PASSWORD", ""),
		RedisDB:               getEnvAsInt("REDIS_DB", 0),
		MonitoringEnabled:     getEnvAsBool("PLC_MONITORING_ENABLED", true),
		MonitoringInterval:    getEnvAsInt("PLC_MONITORING_INTERVAL", 5),
		TagBatchSize:          getEnvAsInt("PLC_TAG_BATCH_SIZE", 100),
		EnableSyncService:     getEnvAsBool("PLC_ENABLE_SYNC", true),
		SyncInterval:          getEnvAsInt("PLC_SYNC_INTERVAL", 5),
		ConnectionTimeout:     getEnvAsInt("PLC_CONNECTION_TIMEOUT", 10),
		EnableDebugLogging:    getEnvAsBool("PLC_DEBUG_LOGGING", false),
		EnableDetailedLogging: getEnvAsBool("PLC_DETAILED_LOGGING", false),
	}
}

// LoadConfig carrega configurações do arquivo .env
func LoadConfig(path string) (*Config, error) {
	// Carregar arquivo .env
	err := godotenv.Load(path)
	if err != nil {
		// Apenas logar o erro, mas continuar - podemos ter variáveis de ambiente em produção
		log.Printf("Aviso: Arquivo .env não encontrado em %s: %v", path, err)
	}

	// Verificar se SECRET_KEY está presente
	if getEnv("JWT_SECRET", "") == "" {
		return nil, fmt.Errorf("variável de ambiente JWT_SECRET é obrigatória")
	}

	// Obter configurações
	expirationHours, _ := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "24"))
	serverReadTimeout, _ := strconv.Atoi(getEnv("SERVER_READ_TIMEOUT", "10"))
	serverWriteTimeout, _ := strconv.Atoi(getEnv("SERVER_WRITE_TIMEOUT", "10"))
	bcryptCost, _ := strconv.Atoi(getEnv("SECURITY_BCRYPT_COST", "10"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	redisEnabled, _ := strconv.ParseBool(getEnv("REDIS_ENABLED", "true"))
	csrfTokenExpiry, _ := strconv.Atoi(getEnv("SECURITY_CSRF_EXPIRY", "30"))
	enableCSRF, _ := strconv.ParseBool(getEnv("SECURITY_ENABLE_CSRF", "true"))
	enableCORS, _ := strconv.ParseBool(getEnv("SERVER_ENABLE_CORS", "true"))

	// Configuração para arrays
	trustedProxies := strings.Split(getEnv("SERVER_TRUSTED_PROXIES", "127.0.0.1"), ",")
	corsAllowedOrigins := strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "*"), ",")
	corsAllowedMethods := strings.Split(getEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,OPTIONS"), ",")

	// Carregar configurações PLC
	plcConfig := LoadPLCConfig()

	// Criar e retornar configuração
	return &Config{
		Server: ServerConfig{
			Port:               getEnv("SERVER_PORT", "8080"),
			Host:               getEnv("SERVER_HOST", "localhost"),
			ReadTimeout:        serverReadTimeout,
			WriteTimeout:       serverWriteTimeout,
			MaxHeaderBytes:     1 << 20, // 1 MB
			TrustedProxies:     trustedProxies,
			EnableCORS:         enableCORS,
			AllowedOrigins:     corsAllowedOrigins,
			CorsAllowedMethods: corsAllowedMethods,
		},
		DB: database.Config{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "app_padrao"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			SecretKey:        getEnv("JWT_SECRET", ""),
			ExpirationHours:  expirationHours,
			Issuer:           getEnv("JWT_ISSUER", "app_padrao"),
			SkipVerification: getEnvAsBool("JWT_SKIP_VERIFICATION", false),
		},
		PLC: plcConfig,
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       redisDB,
			Enabled:  redisEnabled,
		},
		Security: SecurityConfig{
			PasswordMinLength: 8,
			BcryptCost:        bcryptCost,
			EnableCSRF:        enableCSRF,
			CSRFTokenExpiry:   csrfTokenExpiry,
		},
	}, nil
}

// GetEnv obtém uma variável de ambiente ou usa valor padrão
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getEnvAsInt obtém uma variável de ambiente como int
func getEnvAsInt(name string, defaultVal int) int {
	valueStr := getEnv(name, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultVal
}

// getEnvAsBool obtém uma variável de ambiente como bool
func getEnvAsBool(name string, defaultVal bool) bool {
	valueStr := getEnv(name, "")
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultVal
}

// GetConfigPath retorna o caminho do arquivo de configuração com base no ambiente
func GetConfigPath(env string) string {
	if env == "test" {
		return "../.env.test"
	} else if env == "prod" || env == "production" {
		return "/etc/app_padrao/.env"
	}
	return "./.env"
}

// ValidateConfig verifica se a configuração é válida
func ValidateConfig(cfg *Config) []string {
	issues := make([]string, 0)

	// Verificar segredos
	if cfg.JWT.SecretKey == "" || cfg.JWT.SecretKey == "seu_segredo_super_seguro" {
		issues = append(issues, "JWT_SECRET não está definido ou está usando valor padrão inseguro")
	}

	// Verificar conexão com banco de dados
	if cfg.DB.User == "" || cfg.DB.Password == "" {
		issues = append(issues, "Credenciais de banco de dados incompletas")
	}

	return issues
}
