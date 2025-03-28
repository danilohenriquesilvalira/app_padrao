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

type Server struct {
	router            *gin.Engine
	httpServer        *http.Server
	authHandler       *handler.AuthHandler
	userHandler       *handler.UserHandler
	adminHandler      *handler.AdminHandler
	permissionHandler *handler.PermissionHandler
	profileHandler    *handler.ProfileHandler // Adicionado handler de perfil
	userRepo          domain.UserRepository
	cfg               *config.Config
}

func NewServer(
	cfg *config.Config,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	adminHandler *handler.AdminHandler,
	permissionHandler *handler.PermissionHandler,
	profileHandler *handler.ProfileHandler, // Adicionado handler de perfil
	userRepo domain.UserRepository,
) *Server {
	router := gin.Default()

	return &Server{
		router:            router,
		authHandler:       authHandler,
		userHandler:       userHandler,
		adminHandler:      adminHandler,
		permissionHandler: permissionHandler,
		profileHandler:    profileHandler, // Adicionado handler de perfil
		userRepo:          userRepo,
		cfg:               cfg,
	}
}

func (s *Server) Run() error {
	route.SetupRoutes(
		s.router,
		s.authHandler,
		s.userHandler,
		s.adminHandler,
		s.permissionHandler,
		s.profileHandler, // Adicionado handler de perfil
		s.userRepo,
		s.cfg.JWT.SecretKey,
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
