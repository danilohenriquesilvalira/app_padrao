// internal/api/middleware/permission.go
package middleware

import (
	"app_padrao/internal/domain"
	"net/http"

	"github.com/gin-gonic/gin"
)

func PermissionMiddleware(userRepo domain.UserRepository, permissionCode string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "usuário não autenticado"})
			c.Abort()
			return
		}

		hasPermission, err := userRepo.HasPermission(userID.(int), permissionCode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao verificar permissão"})
			c.Abort()
			return
		}

		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{"error": "permissão negada"})
			c.Abort()
			return
		}

		c.Next()
	}
}
