// internal/service/theme.go
package service

import (
	"app_padrao/internal/domain"
)

type ThemeService struct {
	repo domain.ThemeRepository
}

func NewThemeService(repo domain.ThemeRepository) *ThemeService {
	return &ThemeService{repo: repo}
}

func (s *ThemeService) GetAll() ([]domain.Theme, error) {
	return s.repo.GetAll()
}

func (s *ThemeService) GetByID(id int) (domain.Theme, error) {
	return s.repo.GetByID(id)
}

func (s *ThemeService) GetByName(name string) (domain.Theme, error) {
	return s.repo.GetByName(name)
}

func (s *ThemeService) GetDefault() (domain.Theme, error) {
	return s.repo.GetDefault()
}
