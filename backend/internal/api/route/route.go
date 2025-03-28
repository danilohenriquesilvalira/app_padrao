// internal/api/route/route.go
package route

import (
	"app_padrao/internal/api/handler"
	"app_padrao/internal/api/middleware"
	"app_padrao/internal/domain"
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
	userRepo domain.UserRepository,
	jwtSecret string,
) {
	// CORS
	router.Use(corsMiddleware())

	// Criar diretório de uploads se não existir
	os.MkdirAll("uploads/avatars", os.ModePerm)

	// Servir arquivos estáticos
	router.Static("/avatars", "./uploads/avatars")

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
		api.PUT("/profile/password", profileHandler.ChangePassword)
		api.DELETE("/profile", profileHandler.DeleteAccount)

		// Temas
		api.GET("/themes", profileHandler.GetThemes)

		// Permissões
		api.GET("/permissions", permissionHandler.GetUserPermissions)

		// Admin - temporariamente sem middleware de permissão para teste
		admin := api.Group("/admin")
		//admin.Use(middleware.PermissionMiddleware(userRepo, "admin_panel"))
		{
			// Usuários - sem verificação de permissão para teste
			admin.GET("/users", adminHandler.ListUsers)
			admin.GET("/users/:id", adminHandler.GetUser)
			admin.PUT("/users/:id", adminHandler.UpdateUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.POST("/users", adminHandler.CreateUser)

			// Roles
			admin.GET("/roles", adminHandler.ListRoles)
		}
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
