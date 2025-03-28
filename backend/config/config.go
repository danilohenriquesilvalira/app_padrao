// internal/config/config.go - CORRIGIDO
package config

import (
	"app_padrao/pkg/database"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server ServerConfig
	DB     database.Config
	JWT    JWTConfig
}

type ServerConfig struct {
	Port string
}

type JWTConfig struct {
	SecretKey       string
	ExpirationHours int
}

func LoadConfig(path string) (*Config, error) {
	err := godotenv.Load(path)
	if err != nil {
		return nil, err
	}

	expirationHours, _ := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "24"))

	return &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
		},
		DB: database.Config{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     "danilo",
			Password: "Danilo@34333528",
			DBName:   getEnv("DB_NAME", "app_padrao"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			SecretKey:       getEnv("JWT_SECRET", "seu_segredo_super_seguro"),
			ExpirationHours: expirationHours,
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
