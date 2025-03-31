// internal/api/server.go
package api

import (
	"app_padrao/internal/api/handler"
	"app_padrao/internal/api/route"
	"app_padrao/internal/config"
	"app_padrao/internal/domain"
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Server struct com campo app para componentes globais
type Server struct {
	router            *gin.Engine
	httpServer        *http.Server
	authHandler       *handler.AuthHandler
	userHandler       *handler.UserHandler
	adminHandler      *handler.AdminHandler
	permissionHandler *handler.PermissionHandler
	profileHandler    *handler.ProfileHandler
	plcHandler        *handler.PLCHandler // NOVO: handler do PLC
	userRepo          domain.UserRepository
	cfg               *config.Config
	app               *route.Application // Campo para Application
}

func NewServer(
	cfg *config.Config,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	adminHandler *handler.AdminHandler,
	permissionHandler *handler.PermissionHandler,
	profileHandler *handler.ProfileHandler,
	plcHandler *handler.PLCHandler, // NOVO: handler do PLC
	userRepo domain.UserRepository,
	app *route.Application, // Novo parâmetro para Application
) *Server {
	router := gin.Default()

	return &Server{
		router:            router,
		authHandler:       authHandler,
		userHandler:       userHandler,
		adminHandler:      adminHandler,
		permissionHandler: permissionHandler,
		profileHandler:    profileHandler,
		plcHandler:        plcHandler, // NOVO: handler do PLC
		userRepo:          userRepo,
		cfg:               cfg,
		app:               app, // Inicializa o novo campo
	}
}

func (s *Server) Run() error {
	// Passar todos os parâmetros para SetupRoutes, incluindo o app
	route.SetupRoutes(
		s.router,
		s.authHandler,
		s.userHandler,
		s.adminHandler,
		s.permissionHandler,
		s.profileHandler,
		s.plcHandler, // NOVO: handler do PLC
		s.userRepo,
		s.cfg.JWT.SecretKey,
		s.app, // Passar a instância de Application
	)

	s.httpServer = &http.Server{
		Addr:           ":" + s.cfg.Server.Port,
		Handler:        s.router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	log.Printf("Servidor iniciado na porta %s", s.cfg.Server.Port)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
