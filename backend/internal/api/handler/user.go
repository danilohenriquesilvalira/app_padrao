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

	c.JSON(http.StatusOK, gin.H{"user": userResponse{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
	}})
}
