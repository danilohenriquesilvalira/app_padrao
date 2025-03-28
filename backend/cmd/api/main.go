// cmd/api/main.go
package main

import (
	"app_padrao/internal/api"
	"app_padrao/internal/api/handler"
	"app_padrao/internal/config"
	"app_padrao/internal/repository"
	"app_padrao/internal/service"
	"app_padrao/pkg/database"
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
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

	// Repositórios
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	themeRepo := repository.NewThemeRepository(db)     // Novo repositório de temas
	profileRepo := repository.NewProfileRepository(db) // Novo repositório de perfis

	// Serviços
	userService := service.NewUserService(userRepo, cfg.JWT.SecretKey, cfg.JWT.ExpirationHours)
	roleService := service.NewRoleService(roleRepo)
	themeService := service.NewThemeService(themeRepo)       // Novo serviço de temas
	profileService := service.NewProfileService(profileRepo) // Novo serviço de perfis

	// Handlers
	authHandler := handler.NewAuthHandler(userService)
	userHandler := handler.NewUserHandler(userService)
	adminHandler := handler.NewAdminHandler(userService, roleService)
	permissionHandler := handler.NewPermissionHandler(roleService)
	profileHandler := handler.NewProfileHandler(profileService, userService, themeService) // Novo handler de perfil

	// Servidor
	server := api.NewServer(cfg, authHandler, userHandler, adminHandler, permissionHandler, profileHandler, userRepo)

	// Iniciar servidor em goroutine
	go func() {
		if err := server.Run(); err != nil {
			log.Fatalf("Erro ao iniciar servidor: %v", err)
		}
	}()

	// Configurar desligamento gracioso
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Desligando servidor...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Erro ao desligar servidor: %v", err)
	}

	log.Println("Servidor finalizado")
}
