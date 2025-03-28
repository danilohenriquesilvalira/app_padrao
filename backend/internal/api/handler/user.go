// internal/api/handler/user.go
package handler

import (
	"app_padrao/internal/domain"
	"net/http"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService domain.UserService
}

func NewUserHandler(userService domain.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	user, err := h.userService.GetByID(userID.(int))
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

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input struct {
		FullName string `json:"full_name"`
		Phone    string `json:"phone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Carregar usuário atual
	user, err := h.userService.GetByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Atualizar campos permitidos
	user.FullName = input.FullName
	user.Phone = input.Phone

	err = h.userService.Update(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Perfil atualizado com sucesso",
		"user":    user,
	})
}
