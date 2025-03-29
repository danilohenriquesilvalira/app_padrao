package main

import (
	"app_padrao/internal/api"
	"app_padrao/internal/api/handler"
	"app_padrao/internal/cache"
	"app_padrao/internal/config"
	"app_padrao/internal/repository"
	"app_padrao/internal/service"
	"app_padrao/pkg/database"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	// Carregar configurações
	cfg, err := config.LoadConfig("../../.env")
	if err != nil {
		log.Fatalf("Erro ao carregar configurações: %v", err)
	}

	// Inicializar banco de dados
	db, err := database.NewPostgresDB(cfg.DB)
	if err != nil {
		log.Fatalf("Erro ao conectar ao banco de dados: %v", err)
	}
	defer db.Close()
	log.Println("Conexão com o banco de dados estabelecida")

	// Inicializar repositórios
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	profileRepo := repository.NewProfileRepository(db)
	themeRepo := repository.NewThemeRepository(db)

	// Inicializar repositórios PLC
	plcRepo := repository.NewPLCRepository(db)
	plcTagRepo := repository.NewPLCTagRepository(db)

	// Inicializar cache Redis com valores da configuração
	redisAddr := fmt.Sprintf("%s:6379", cfg.DB.Host) // Usando mesmo host que o DB, ajuste se necessário
	redisCache, err := cache.NewRedisCache(
		redisAddr,
		"", // sem senha
		0,  // banco de dados Redis 0
	)
	if err != nil {
		log.Fatalf("Falha ao conectar ao Redis: %v", err)
	}

	// Inicializar serviços
	userService := service.NewUserService(userRepo, cfg.JWT.SecretKey, cfg.JWT.ExpirationHours)
	roleService := service.NewRoleService(roleRepo)
	profileService := service.NewProfileService(profileRepo)
	themeService := service.NewThemeService(themeRepo)

	// Inicializar serviço PLC
	plcService := service.NewPLCService(plcRepo, plcTagRepo, redisCache)

	// Inicializar handlers
	authHandler := handler.NewAuthHandler(userService)
	userHandler := handler.NewUserHandler(userService)
	adminHandler := handler.NewAdminHandler(userService, roleService)
	permissionHandler := handler.NewPermissionHandler(roleService)
	profileHandler := handler.NewProfileHandler(profileService, userService, themeService)

	// Inicializar handler PLC
	plcHandler := handler.NewPLCHandler(plcService)

	// Inicializar servidor
	server := api.NewServer(
		cfg,
		authHandler,
		userHandler,
		adminHandler,
		permissionHandler,
		profileHandler,
		plcHandler,
		userRepo,
	)

	// Iniciar monitoramento de PLCs
	log.Println("Iniciando monitoramento de PLCs...")
	if err := plcService.StartMonitoring(); err != nil {
		log.Printf("Erro ao iniciar monitoramento de PLCs: %v", err)
	} else {
		log.Println("Monitoramento de PLCs iniciado com sucesso")
	}

	// Configurar graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := server.Run(); err != nil {
			log.Fatalf("Erro ao iniciar servidor: %v", err)
		}
	}()

	log.Println("Servidor iniciado")

	// Aguardar sinal para desligar
	<-quit
	log.Println("Desligando servidor...")

	// Parar monitoramento de PLCs antes de encerrar
	log.Println("Parando monitoramento de PLCs...")
	if err := plcService.StopMonitoring(); err != nil {
		log.Printf("Erro ao parar monitoramento de PLCs: %v", err)
	} else {
		log.Println("Monitoramento de PLCs parado com sucesso")
	}

	// Dar 10 segundos para conexões existentes terminarem
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Erro ao desligar servidor: %v", err)
	}

	log.Println("Servidor encerrado com sucesso")
}
