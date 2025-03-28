// internal/api/handler/admin.go
package handler

import (
	"app_padrao/internal/domain"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	userService domain.UserService
	roleService domain.RoleService
}

func NewAdminHandler(userService domain.UserService, roleService domain.RoleService) *AdminHandler {
	return &AdminHandler{
		userService: userService,
		roleService: roleService,
	}
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	users, total, err := h.userService.List(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users":    users,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *AdminHandler) GetUser(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	user, err := h.userService.GetByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrUserNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *AdminHandler) CreateUser(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Role     string `json:"role"`
		IsActive bool   `json:"is_active"`
		FullName string `json:"full_name"`
		Phone    string `json:"phone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := domain.User{
		Username: input.Username,
		Email:    input.Email,
		Password: input.Password,
		Role:     input.Role,
		IsActive: input.IsActive,
		FullName: input.FullName,
		Phone:    input.Phone,
	}

	id, err := h.userService.Register(user)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrEmailInUse || err == domain.ErrUsernameInUse {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "Usuário criado com sucesso",
	})
}

func (h *AdminHandler) UpdateUser(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		IsActive bool   `json:"is_active"`
		FullName string `json:"full_name"`
		Phone    string `json:"phone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := domain.User{
		ID:       id,
		Username: input.Username,
		Email:    input.Email,
		Role:     input.Role,
		IsActive: input.IsActive,
		FullName: input.FullName,
		Phone:    input.Phone,
	}

	err := h.userService.Update(user)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrUserNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuário atualizado com sucesso"})
}

func (h *AdminHandler) DeleteUser(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	err := h.userService.Delete(id)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrUserNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuário excluído com sucesso"})
}

func (h *AdminHandler) ListRoles(c *gin.Context) {
	roles, err := h.roleService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"roles": roles})
}
