package main

import (
	"app_padrao/internal/api"
	"app_padrao/internal/api/handler"
	"app_padrao/internal/api/route"
	"app_padrao/internal/cache"
	"app_padrao/internal/config"
	"app_padrao/internal/health"
	"app_padrao/internal/metrics"
	"app_padrao/internal/repository"
	"app_padrao/internal/service"
	"app_padrao/pkg/database"
	"app_padrao/pkg/resilience"
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

	// Inicializar repositórios PLC PostgreSQL
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

	// Verificar saúde do Redis
	if err := redisCache.VerifyRedisHealth(); err != nil {
		log.Printf("Aviso: Redis apresentou problemas na verificação de saúde: %v", err)
		log.Println("Continuando mesmo assim, mas operações Redis podem falhar")
	} else {
		log.Println("Verificação de saúde do Redis concluída com sucesso")
	}

	// Inicializar componentes de observabilidade e resiliência
	metricsCollector := metrics.NewMetricsCollector()
	healthChecker := health.NewHealthCheck()

	// Verificar saúde inicial dos componentes
	healthChecker.CheckPostgres(db)
	healthChecker.CheckRedis(redisCache.GetRedisClient())

	// Configurar rate limiter para operações de PLC (limita 100 operações por segundo por PLC)
	rateLimiter := resilience.NewRateLimiter(100, time.Second)

	// Registrar componentes no contexto global da aplicação
	app := &route.Application{
		MetricsCollector: metricsCollector,
		HealthChecker:    healthChecker,
		RateLimiter:      rateLimiter, // Adicionar o rate limiter à aplicação
	}

	// Iniciar verificação periódica de saúde
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				healthChecker.CheckPostgres(db)
				healthChecker.CheckRedis(redisCache.GetRedisClient())

				// Registrar métricas de saúde
				status := healthChecker.GetOverallStatus()
				statusValue := 0.0
				if status == health.StatusHealthy {
					statusValue = 1.0
				} else if status == health.StatusDegraded {
					statusValue = 0.5
				}
				metricsCollector.SetGauge("system.health.status", statusValue)
			}
		}
	}()

	// Inicializar serviços
	userService := service.NewUserService(userRepo, cfg.JWT.SecretKey, cfg.JWT.ExpirationHours)
	roleService := service.NewRoleService(roleRepo)
	profileService := service.NewProfileService(profileRepo)
	themeService := service.NewThemeService(themeRepo)

	// Inicializar serviço PLC com arquitetura Redis
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
		app, // Passar a referência para Application
	)

	// Iniciar monitoramento de PLCs
	log.Println("Iniciando monitoramento de PLCs...")
	if err := plcService.StartMonitoring(); err != nil {
		log.Printf("Erro ao iniciar monitoramento de PLCs: %v", err)

		// Registrar falha nas métricas
		metricsCollector.IncrementCounter("plc.monitoring.start_failures", 1)
	} else {
		log.Println("Monitoramento de PLCs iniciado com sucesso")

		// Registrar sucesso nas métricas
		metricsCollector.IncrementCounter("plc.monitoring.starts", 1)

		// Verificar se os endereços das tags correspondem aos do PLC
		if err := plcService.VerifyTagAddresses(); err != nil {
			log.Printf("Erro ao verificar endereços das tags: %v", err)
			metricsCollector.IncrementCounter("plc.tag.address_verification_failures", 1)
		} else {
			metricsCollector.IncrementCounter("plc.tag.address_verifications", 1)
		}

		// Iniciar monitor de depuração para visualizar valores
		plcService.StartDebugMonitor()
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
	metricsCollector.IncrementCounter("server.starts", 1)

	// Aguardar sinal para desligar
	<-quit
	log.Println("Desligando servidor...")

	// Parar monitoramento de PLCs antes de encerrar
	log.Println("Parando monitoramento de PLCs...")
	if err := plcService.StopMonitoring(); err != nil {
		log.Printf("Erro ao parar monitoramento de PLCs: %v", err)
		metricsCollector.IncrementCounter("plc.monitoring.stop_failures", 1)
	} else {
		log.Println("Monitoramento de PLCs parado com sucesso")
		metricsCollector.IncrementCounter("plc.monitoring.stops", 1)
	}

	// Dar 10 segundos para conexões existentes terminarem
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Erro ao desligar servidor: %v", err)
	}

	log.Println("Servidor encerrado com sucesso")
	metricsCollector.IncrementCounter("server.graceful_shutdowns", 1)
}
