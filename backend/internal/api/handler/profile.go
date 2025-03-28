// internal/api/handler/profile.go
package handler

import (
	"app_padrao/internal/domain"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ProfileHandler struct {
	profileService domain.ProfileService
	userService    domain.UserService
	themeService   domain.ThemeService
}

func NewProfileHandler(profileService domain.ProfileService, userService domain.UserService, themeService domain.ThemeService) *ProfileHandler {
	return &ProfileHandler{
		profileService: profileService,
		userService:    userService,
		themeService:   themeService,
	}
}

// GetProfile recupera o perfil do usuário logado
func (h *ProfileHandler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	profile, err := h.profileService.GetByUserID(userID.(int))
	if err != nil {
		if err == domain.ErrProfileNotFound {
			// Se não existir, cria um perfil padrão
			profile = domain.Profile{
				UserID:    userID.(int),
				Theme:     "default",
				FontSize:  "medium",
				Language:  "pt_BR",
				CreatedAt: time.Now(),
			}
			_, err = h.profileService.Create(profile)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao criar perfil padrão"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar perfil"})
			return
		}
	}

	// Buscar o tema associado ao perfil
	theme, err := h.themeService.GetByName(profile.Theme)
	if err != nil {
		theme, _ = h.themeService.GetDefault()
	}

	// Buscar dados do usuário
	user, err := h.userService.GetByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar dados do usuário"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"profile": profile,
		"theme":   theme,
		"user":    user,
	})
}

// UpdateProfile atualiza o perfil do usuário
func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input struct {
		Bio                     string          `json:"bio"`
		Department              string          `json:"department"`
		Theme                   string          `json:"theme"`
		FontSize                string          `json:"font_size"`
		Language                string          `json:"language"`
		NotificationPreferences map[string]bool `json:"notification_preferences"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verificar se o tema existe
	if input.Theme != "" {
		_, err := h.themeService.GetByName(input.Theme)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tema não encontrado"})
			return
		}
	}

	// Buscar perfil existente ou criar um novo
	profile, err := h.profileService.GetByUserID(userID.(int))
	if err != nil {
		if err == domain.ErrProfileNotFound {
			profile = domain.Profile{
				UserID:    userID.(int),
				CreatedAt: time.Now(),
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar perfil"})
			return
		}
	}

	// Atualizar os campos fornecidos
	if input.Bio != "" {
		profile.Bio = input.Bio
	}
	if input.Department != "" {
		profile.Department = input.Department
	}
	if input.Theme != "" {
		profile.Theme = input.Theme
	}
	if input.FontSize != "" {
		profile.FontSize = input.FontSize
	}
	if input.Language != "" {
		profile.Language = input.Language
	}
	if input.NotificationPreferences != nil {
		profile.NotificationPreferences = input.NotificationPreferences
	}

	profile.UpdatedAt = time.Now()

	// Salvar o perfil
	if profile.ID > 0 {
		err = h.profileService.Update(profile)
	} else {
		_, err = h.profileService.Create(profile)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao atualizar perfil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Perfil atualizado com sucesso",
		"profile": profile,
	})
}

// Função auxiliar para gerar nome de arquivo único
func generateUniqueFilename(originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	// Usar timestamp como parte do nome para garantir unicidade
	timestamp := strconv.FormatInt(time.Now().UnixNano(), 10)
	// Limitar comprimento do nome original para evitar nomes muito longos
	baseName := strings.TrimSuffix(originalFilename, ext)
	if len(baseName) > 20 {
		baseName = baseName[:20]
	}
	// Formato: timestamp_nome-original.extensão
	return fmt.Sprintf("%s_%s%s", timestamp, baseName, ext)
}

// UploadAvatar processa o upload da foto de perfil
func (h *ProfileHandler) UploadAvatar(c *gin.Context) {
	userID, _ := c.Get("userID")

	// Receber o arquivo de imagem
	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Arquivo não encontrado"})
		return
	}

	// Validar o tipo de arquivo
	ext := filepath.Ext(file.Filename)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de arquivo não suportado. Use JPG ou PNG"})
		return
	}

	// Gerar nome único para o arquivo
	filename := generateUniqueFilename(file.Filename)
	dstPath := filepath.Join("uploads/avatars", filename)

	// Salvar o arquivo
	if err := c.SaveUploadedFile(file, dstPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao salvar imagem"})
		return
	}

	// Atualizar o avatar_url no perfil
	profile, err := h.profileService.GetByUserID(userID.(int))

	if err != nil {
		if err == domain.ErrProfileNotFound {
			// Criar um novo perfil se não existir
			profile = domain.Profile{
				UserID:    userID.(int),
				AvatarURL: fmt.Sprintf("/avatars/%s", filename),
				CreatedAt: time.Now(),
			}
			_, err = h.profileService.Create(profile)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar perfil"})
			return
		}
	} else {
		// Atualizar o perfil existente
		profile.AvatarURL = fmt.Sprintf("/avatars/%s", filename)
		profile.UpdatedAt = time.Now()
		err = h.profileService.Update(profile)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao atualizar perfil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Avatar atualizado com sucesso",
		"avatar_url": profile.AvatarURL,
	})
}

// GetThemes retorna a lista de temas disponíveis
func (h *ProfileHandler) GetThemes(c *gin.Context) {
	themes, err := h.themeService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar temas"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"themes": themes})
}
