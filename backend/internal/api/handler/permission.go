// internal/api/handler/permission.go
package handler

import (
	"app_padrao/internal/domain"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type PermissionHandler struct {
	roleService domain.RoleService
}

func NewPermissionHandler(roleService domain.RoleService) *PermissionHandler {
	return &PermissionHandler{
		roleService: roleService,
	}
}

func (h *PermissionHandler) GetUserPermissions(c *gin.Context) {
	// Obter ID do usuário do contexto
	userIDValue, exists := c.Get("userID")
	if !exists {
		// Se não houver ID de usuário, retornar array vazio para evitar erro no frontend
		c.JSON(http.StatusOK, gin.H{
			"permissions": []string{},
		})
		return
	}

	// Converta para int e utilize o userID (para evitar o erro de variável não utilizada)
	userID, ok := userIDValue.(int)
	if !ok {
		log.Printf("Erro ao converter userID para int")
		c.JSON(http.StatusOK, gin.H{
			"permissions": []string{},
		})
		return
	}

	// Registrar que estamos buscando permissões para este usuário
	log.Printf("Buscando permissões para o usuário ID: %d", userID)

	// Lista hardcoded para teste - mantendo isso por compatibilidade
	// Em uma implementação real, você usaria o userID para consultar o banco de dados
	permissions := []string{"user_view", "user_update", "admin_panel"}

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
	})
}
