// internal/domain/profile.go
package domain

import (
	"errors"
	"time"
)

type Profile struct {
	// Removido ID como campo separado
	UserID                  int             `json:"user_id"`
	AvatarURL               string          `json:"avatar_url"`
	Bio                     string          `json:"bio"`
	Department              string          `json:"department"`
	NotificationPreferences map[string]bool `json:"notification_preferences"`
	Theme                   string          `json:"theme"`
	FontSize                string          `json:"font_size"`
	Language                string          `json:"language"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`
}

type Theme struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	PrimaryColor    string `json:"primary_color"`
	SecondaryColor  string `json:"secondary_color"`
	TextColor       string `json:"text_color"`
	BackgroundColor string `json:"background_color"`
	AccentColor     string `json:"accent_color"`
	IsDefault       bool   `json:"is_default"`
}

type ProfileRepository interface {
	Create(profile Profile) (int, error)
	GetByUserID(userID int) (Profile, error)
	Update(profile Profile) error
	Delete(id int) error
}

type ThemeRepository interface {
	GetAll() ([]Theme, error)
	GetByID(id int) (Theme, error)
	GetByName(name string) (Theme, error)
	GetDefault() (Theme, error)
}

type ProfileService interface {
	Create(profile Profile) (int, error)
	GetByUserID(userID int) (Profile, error)
	Update(profile Profile) error
	Delete(id int) error
}

type ThemeService interface {
	GetAll() ([]Theme, error)
	GetByID(id int) (Theme, error)
	GetByName(name string) (Theme, error)
	GetDefault() (Theme, error)
}

// Erros comuns
var (
	ErrProfileNotFound = errors.New("perfil não encontrado")
	ErrThemeNotFound   = errors.New("tema não encontrado")
)
