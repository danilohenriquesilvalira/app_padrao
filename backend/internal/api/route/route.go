// internal/api/route/route.go
package route

import (
	"app_padrao/internal/api/handler"
	"app_padrao/internal/api/middleware"
	"app_padrao/internal/domain"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

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

	// Diretório de avatares
	avatarDir := "D:\\Avatar"

	// Criar diretório de avatares se não existir
	if err := os.MkdirAll(avatarDir, os.ModePerm); err != nil {
		log.Printf("Erro ao criar diretório de avatares: %v", err)
	}

	// Servir arquivos estáticos do diretório de avatares
	router.Static("/avatar", avatarDir)

	// Rotas para verificação de saúde da API
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Autenticação
	router.POST("/register", authHandler.Register)
	router.POST("/login", authHandler.Login)

	// API autenticada
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(jwtSecret))
	{
		// Perfil e permissões
		api.GET("/profile", profileHandler.GetProfile)
		api.PUT("/profile", profileHandler.UpdateProfile)
		api.POST("/profile/avatar", profileHandler.UploadAvatar)
		api.DELETE("/profile/avatar", profileHandler.DeleteAvatar)
		api.PUT("/profile/password", profileHandler.ChangePassword)
		api.DELETE("/profile", profileHandler.DeleteAccount)

		// Temas
		api.GET("/themes", profileHandler.GetThemes)

		// Permissões
		api.GET("/permissions", permissionHandler.GetUserPermissions)

		// Admin
		admin := api.Group("/admin")
		admin.Use(middleware.PermissionMiddleware(userRepo, "admin_panel"))
		{
			// Usuários
			admin.GET("/users", adminHandler.ListUsers)
			admin.GET("/users/:id", adminHandler.GetUser)
			admin.PUT("/users/:id", adminHandler.UpdateUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.POST("/users", adminHandler.CreateUser)

			// Roles
			admin.GET("/roles", adminHandler.ListRoles)
		}

		// PLC routes - NOVA SEÇÃO
		plc := api.Group("/plc")
		{
			plc.GET("/", plcHandler.GetAllPLCs)
			plc.GET("/:id", plcHandler.GetPLC)
			plc.POST("/", middleware.PermissionMiddleware(userRepo, "plc_create"), plcHandler.CreatePLC)
			plc.PUT("/:id", middleware.PermissionMiddleware(userRepo, "plc_update"), plcHandler.UpdatePLC)
			plc.DELETE("/:id", middleware.PermissionMiddleware(userRepo, "plc_delete"), plcHandler.DeletePLC)

			plc.GET("/:id/tags", plcHandler.GetPLCTags)
			plc.GET("/tags/:id", plcHandler.GetTagByID)
			plc.POST("/:id/tags", middleware.PermissionMiddleware(userRepo, "plc_tag_create"), plcHandler.CreatePLCTag)
			plc.PUT("/tags/:id", middleware.PermissionMiddleware(userRepo, "plc_tag_update"), plcHandler.UpdatePLCTag)
			plc.DELETE("/tags/:id", middleware.PermissionMiddleware(userRepo, "plc_tag_delete"), plcHandler.DeletePLCTag)

			plc.POST("/tag/write", middleware.PermissionMiddleware(userRepo, "plc_write"), plcHandler.WriteTagValue)

			// Novas rotas para diagnóstico e estatísticas
			plc.GET("/diagnostic/tags", plcHandler.DiagnosticTags)
			plc.POST("/reset/:id", middleware.PermissionMiddleware(userRepo, "plc_admin"), plcHandler.ResetPLCConnection)
			plc.GET("/health", plcHandler.GetPLCHealth)
			plc.GET("/stats", plcHandler.GetDetailedStats)
			plc.GET("/status", plcHandler.GetPLCStatus) // Rota existente para compatibilidade
		}
	}
}

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
