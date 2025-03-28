// internal/api/handler/permission.go
package handler

import (
	"app_padrao/internal/domain"
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
	// Lista hardcoded para teste
	permissions := []string{"user_view", "user_update", "admin_panel"}

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
	})
}
