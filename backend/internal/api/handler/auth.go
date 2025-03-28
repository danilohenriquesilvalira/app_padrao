// internal/api/handler/auth.go
package handler

import (
	"app_padrao/internal/domain"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	userService domain.UserService
}

func NewAuthHandler(userService domain.UserService) *AuthHandler {
	return &AuthHandler{
		userService: userService,
	}
}

type registerRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	IsActive bool   `json:"is_active"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type userResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	IsActive bool   `json:"is_active"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := domain.User{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
		IsActive: req.IsActive,
		FullName: req.FullName,
		Phone:    req.Phone,
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
		"message": "Usuário registrado com sucesso",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.userService.Login(req.Email, req.Password)
	if err != nil {
		statusCode := http.StatusInternalServerError

		if err == domain.ErrInvalidCredentials {
			statusCode = http.StatusUnauthorized
		}

		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": userResponse{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
			IsActive: user.IsActive,
			FullName: user.FullName,
			Phone:    user.Phone,
		},
	})
}
