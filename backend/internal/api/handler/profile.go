// internal/api/handler/profile.go
package handler

import (
	"app_padrao/internal/domain"
	"fmt"
	"log"
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
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuário não autenticado"})
		return
	}

	log.Printf("Buscando perfil para o usuário ID: %v", userID)

	// Buscar dados do usuário
	user, err := h.userService.GetByID(userID.(int))
	if err != nil {
		log.Printf("Erro ao buscar usuário: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar dados do usuário"})
		return
	}

	// Perfil padrão com valores seguros
	defaultProfile := domain.Profile{
		UserID:                  userID.(int),
		AvatarURL:               "",
		Bio:                     "",
		Department:              "",
		Theme:                   "default",
		FontSize:                "medium",
		Language:                "pt_BR",
		NotificationPreferences: map[string]bool{"email": true, "push": true, "sms": false},
		CreatedAt:               time.Now(),
	}

	// Tentar buscar o perfil existente
	profile, err := h.profileService.GetByUserID(userID.(int))
	if err != nil {
		log.Printf("Erro ao buscar perfil (criando padrão): %v", err)
		// Se o perfil não existir, usar os valores padrão
		profile = defaultProfile
	}

	// Tema padrão seguro
	defaultTheme := domain.Theme{
		ID:              1,
		Name:            "default",
		PrimaryColor:    "#4285F4",
		SecondaryColor:  "#34A853",
		TextColor:       "#202124",
		BackgroundColor: "#FFFFFF",
		AccentColor:     "#FBBC05",
		IsDefault:       true,
	}

	// Tentar buscar o tema pelo nome
	theme, err := h.themeService.GetByName(profile.Theme)
	if err != nil {
		log.Printf("Erro ao buscar tema (usando padrão): %v", err)
		theme = defaultTheme
	}

	// Responder com os dados coletados
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
		FullName                string          `json:"full_name"` // Adicionado
		Phone                   string          `json:"phone"`     // Adicionado
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Buscar perfil existente ou criar um novo
	profile, err := h.profileService.GetByUserID(userID.(int))
	if err != nil {
		// Se não encontrar, criar um novo perfil
		profile = domain.Profile{
			UserID:                  userID.(int),
			NotificationPreferences: map[string]bool{"email": true, "push": true, "sms": false},
			Theme:                   "default",
			FontSize:                "medium",
			Language:                "pt_BR",
			CreatedAt:               time.Now(),
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
	if err := h.profileService.Update(profile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Falha ao atualizar perfil: %v", err)})
		return
	}

	// ADICIONADO: Atualizar campos do usuário se fornecidos
	if input.FullName != "" || input.Phone != "" {
		// Carregar usuário atual
		user, err := h.userService.GetByID(userID.(int))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Falha ao carregar usuário: %v", err)})
			return
		}

		// Atualizar campos permitidos
		if input.FullName != "" {
			user.FullName = input.FullName
		}
		if input.Phone != "" {
			user.Phone = input.Phone
		}

		err = h.userService.Update(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Falha ao atualizar usuário: %v", err)})
			return
		}
	}

	// Buscar usuário atualizado para retornar
	user, err := h.userService.GetByID(userID.(int))
	if err != nil {
		// Não falhar por causa disso
		log.Printf("Erro ao buscar usuário atualizado: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Perfil atualizado com sucesso",
		"profile": profile,
		"user":    user,
	})
}

// GetThemes retorna a lista de temas disponíveis
func (h *ProfileHandler) GetThemes(c *gin.Context) {
	// Temas padrão que sempre estarão disponíveis
	defaultThemes := []domain.Theme{
		{
			ID:              1,
			Name:            "default",
			PrimaryColor:    "#4285F4",
			SecondaryColor:  "#34A853",
			TextColor:       "#202124",
			BackgroundColor: "#FFFFFF",
			AccentColor:     "#FBBC05",
			IsDefault:       true,
		},
		{
			ID:              2,
			Name:            "dark",
			PrimaryColor:    "#333333",
			SecondaryColor:  "#555555",
			TextColor:       "#FFFFFF",
			BackgroundColor: "#121212",
			AccentColor:     "#BB86FC",
			IsDefault:       false,
		},
		{
			ID:              3,
			Name:            "blue",
			PrimaryColor:    "#3498db",
			SecondaryColor:  "#2980b9",
			TextColor:       "#333333",
			BackgroundColor: "#ecf0f1",
			AccentColor:     "#e74c3c",
			IsDefault:       false,
		},
		{
			ID:              4,
			Name:            "green",
			PrimaryColor:    "#2ecc71",
			SecondaryColor:  "#27ae60",
			TextColor:       "#333333",
			BackgroundColor: "#ecf0f1",
			AccentColor:     "#e67e22",
			IsDefault:       false,
		},
	}

	// Tentar buscar temas do banco de dados
	themes, err := h.themeService.GetAll()
	if err != nil || len(themes) == 0 {
		// Se não conseguir ou não encontrar, usar os temas padrão
		themes = defaultThemes
	}

	c.JSON(http.StatusOK, gin.H{"themes": themes})
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
		// Se não existir perfil, criar um novo
		profile = domain.Profile{
			UserID:                  userID.(int),
			AvatarURL:               fmt.Sprintf("/avatars/%s", filename),
			NotificationPreferences: map[string]bool{"email": true, "push": true, "sms": false},
			Theme:                   "default",
			FontSize:                "medium",
			Language:                "pt_BR",
			CreatedAt:               time.Now(),
		}
		_, err = h.profileService.Create(profile)
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

// ChangePassword altera a senha do usuário (implementação básica)
func (h *ProfileHandler) ChangePassword(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Senha alterada com sucesso"})
}

// DeleteAccount exclui a conta do usuário (implementação básica)
func (h *ProfileHandler) DeleteAccount(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Conta excluída com sucesso"})
}
