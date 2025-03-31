// internal/api/route/route.go
package route

import (
	"app_padrao/internal/api/handler"
	"app_padrao/internal/api/middleware"
	"app_padrao/internal/domain"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	// Remover importação que causa erro
	// "github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRoutes configura as rotas da API
func SetupRoutes(
	router *gin.Engine,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	adminHandler *handler.AdminHandler,
	permissionHandler *handler.PermissionHandler,
	profileHandler *handler.ProfileHandler,
	plcHandler *handler.PLCHandler,
	userRepo domain.UserRepository,
	jwtSecret string,
) {
	// CORS - Configuração melhorada
	router.Use(corsMiddleware())

	// Configuração de diretórios estáticos
	setupStaticDirectories(router)

	// Middleware de recuperação para evitar pânico
	router.Use(gin.Recovery())

	// Middleware de logging personalizado
	router.Use(requestLogger())

	// Rotas para verificação de saúde da API
	setupHealthRoutes(router)

	// Autenticação
	setupAuthRoutes(router, authHandler)

	// API autenticada
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(jwtSecret))
	{
		// Perfil e permissões
		setupProfileRoutes(api, profileHandler)

		// Temas
		api.GET("/themes", profileHandler.GetThemes)

		// Permissões
		api.GET("/permissions", permissionHandler.GetUserPermissions)

		// Admin
		setupAdminRoutes(api, adminHandler, userRepo)

		// PLC routes
		setupPLCRoutes(api, plcHandler, userRepo)
	}
}

// setupStaticDirectories configura os diretórios estáticos
func setupStaticDirectories(router *gin.Engine) {
	// Diretório de avatares
	avatarDir := getAvatarDirectory()

	// Criar diretório de avatares se não existir
	if err := os.MkdirAll(avatarDir, os.ModePerm); err != nil {
		log.Printf("Erro ao criar diretório de avatares: %v", err)
	}

	// Servir arquivos estáticos do diretório de avatares
	router.Static("/avatar", avatarDir)
}

// getAvatarDirectory retorna o diretório de avatares com verificação de segurança
func getAvatarDirectory() string {
	// Obter o diretório de avatares da variável de ambiente ou usar o padrão
	avatarDir := os.Getenv("AVATAR_DIRECTORY")
	if avatarDir == "" {
		// Usar um diretório relativo ao executável se não configurado
		exePath, err := os.Executable()
		if err != nil {
			log.Printf("Aviso: Não foi possível determinar o caminho do executável: %v", err)
			return "avatars"
		}
		avatarDir = filepath.Join(filepath.Dir(exePath), "avatars")
	}

	// Verificar se o diretório é absoluto
	if !filepath.IsAbs(avatarDir) {
		absPath, err := filepath.Abs(avatarDir)
		if err != nil {
			log.Printf("Aviso: Não foi possível converter o caminho para absoluto: %v", err)
		} else {
			avatarDir = absPath
		}
	}

	return avatarDir
}

// setupHealthRoutes configura as rotas de saúde da API
func setupHealthRoutes(router *gin.Engine) {
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   os.Getenv("APP_VERSION"),
		})
	})

	// Rota de verificação de tempo de atividade
	router.GET("/uptime", func(c *gin.Context) {
		c.String(200, fmt.Sprintf("Servidor iniciado em: %s", time.Now().Format(time.RFC3339)))
	})
}

// setupAuthRoutes configura as rotas de autenticação
func setupAuthRoutes(router *gin.Engine, authHandler *handler.AuthHandler) {
	router.POST("/register", authHandler.Register)
	router.POST("/login", authHandler.Login)
	// Remover rota não implementada
	// router.POST("/refresh-token", authHandler.RefreshToken)
}

// setupProfileRoutes configura as rotas de perfil
func setupProfileRoutes(api *gin.RouterGroup, profileHandler *handler.ProfileHandler) {
	api.GET("/profile", profileHandler.GetProfile)
	api.PUT("/profile", profileHandler.UpdateProfile)
	api.POST("/profile/avatar", profileHandler.UploadAvatar)
	api.DELETE("/profile/avatar", profileHandler.DeleteAvatar)
	api.PUT("/profile/password", profileHandler.ChangePassword)
	api.DELETE("/profile", profileHandler.DeleteAccount)
}

// setupAdminRoutes configura as rotas de administração
func setupAdminRoutes(api *gin.RouterGroup, adminHandler *handler.AdminHandler, userRepo domain.UserRepository) {
	admin := api.Group("/admin")
	admin.Use(middleware.PermissionMiddleware(userRepo, "admin_panel"))
	{
		// Usuários
		admin.GET("/users", adminHandler.ListUsers)
		admin.GET("/users/:id", adminHandler.GetUser)
		admin.PUT("/users/:id", adminHandler.UpdateUser)
		admin.DELETE("/users/:id", adminHandler.DeleteUser)
		admin.POST("/users", adminHandler.CreateUser)

		// Roles - Apenas a rota que existe no handler
		admin.GET("/roles", adminHandler.ListRoles)
		// Remover rotas não implementadas
		// admin.GET("/roles/:id", adminHandler.GetRole)
		// admin.POST("/roles", adminHandler.CreateRole)
		// admin.PUT("/roles/:id", adminHandler.UpdateRole)
		// admin.DELETE("/roles/:id", adminHandler.DeleteRole)
	}
}

// setupPLCRoutes configura as rotas de PLC
func setupPLCRoutes(api *gin.RouterGroup, plcHandler *handler.PLCHandler, userRepo domain.UserRepository) {
	plc := api.Group("/plc")
	{
		// Rotas básicas de PLC
		plc.GET("/", plcHandler.GetAllPLCs)
		plc.GET("/:id", plcHandler.GetPLC)
		plc.POST("/", middleware.PermissionMiddleware(userRepo, "plc_create"), plcHandler.CreatePLC)
		plc.PUT("/:id", middleware.PermissionMiddleware(userRepo, "plc_update"), plcHandler.UpdatePLC)
		plc.DELETE("/:id", middleware.PermissionMiddleware(userRepo, "plc_delete"), plcHandler.DeletePLC)

		// Rotas de tags
		plc.GET("/:id/tags", plcHandler.GetPLCTags)
		plc.GET("/tags/:id", plcHandler.GetTagByID)
		plc.POST("/:id/tags", middleware.PermissionMiddleware(userRepo, "plc_tag_create"), plcHandler.CreatePLCTag)
		plc.PUT("/tags/:id", middleware.PermissionMiddleware(userRepo, "plc_tag_update"), plcHandler.UpdatePLCTag)
		plc.DELETE("/tags/:id", middleware.PermissionMiddleware(userRepo, "plc_tag_delete"), plcHandler.DeletePLCTag)

		// Operações de escrita
		plc.POST("/tag/write", middleware.PermissionMiddleware(userRepo, "plc_write"), plcHandler.WriteTagValue)

		// Diagnóstico e estatísticas
		plc.GET("/diagnostic/tags", plcHandler.DiagnosticTags)
		plc.POST("/reset/:id", middleware.PermissionMiddleware(userRepo, "plc_admin"), plcHandler.ResetPLCConnection)
		plc.GET("/health", plcHandler.GetPLCHealth)
		plc.GET("/stats", plcHandler.GetDetailedStats)
		plc.GET("/status", plcHandler.GetPLCStatus)
	}
}

// corsMiddleware cria o middleware CORS com configurações seguras
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Configuração CORS mais abrangente
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		// Resposta imediata para requisições OPTIONS (preflight)
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// requestLogger configura o middleware de logging
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Iniciar cronômetro
		startTime := time.Now()

		// Processar request
		c.Next()

		// Calcular tempo de processamento
		latency := time.Since(startTime)

		// Obter o código de status
		statusCode := c.Writer.Status()

		// Definir campos do log
		path := c.Request.URL.Path
		method := c.Request.Method
		ip := c.ClientIP()

		// Definir um limite de tamanho do path para evitar logs muito longos
		if len(path) > 100 {
			path = path[:97] + "..."
		}

		// Log colorido baseado no status code
		var statusColor, methodColor, resetColor string
		if gin.Mode() != gin.ReleaseMode {
			resetColor = "\033[0m"
			methodColor = "\033[1;34m" // Azul para método

			if statusCode >= 200 && statusCode < 300 {
				statusColor = "\033[1;32m" // Verde para sucesso
			} else if statusCode >= 300 && statusCode < 400 {
				statusColor = "\033[1;33m" // Amarelo para redirecionamento
			} else if statusCode >= 400 && statusCode < 500 {
				statusColor = "\033[1;31m" // Vermelho para erro de cliente
			} else {
				statusColor = "\033[1;35m" // Magenta para erro de servidor
			}
		}

		log.Printf("%s%s%s | %s%d%s | %v | %s | %s",
			methodColor, method, resetColor,
			statusColor, statusCode, resetColor,
			latency,
			ip,
			path)
	}
}
