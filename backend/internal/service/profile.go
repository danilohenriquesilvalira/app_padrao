// internal/service/profile.go
package service

import (
	"app_padrao/internal/domain"
	"time"
)

type ProfileService struct {
	repo domain.ProfileRepository
}

func NewProfileService(repo domain.ProfileRepository) *ProfileService {
	return &ProfileService{repo: repo}
}

func (s *ProfileService) Create(profile domain.Profile) (int, error) {
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = time.Now()
	}
	return s.repo.Create(profile)
}

func (s *ProfileService) GetByUserID(userID int) (domain.Profile, error) {
	return s.repo.GetByUserID(userID)
}

func (s *ProfileService) Update(profile domain.Profile) error {
	profile.UpdatedAt = time.Now()
	return s.repo.Update(profile)
}

func (s *ProfileService) Delete(id int) error {
	return s.repo.Delete(id)
}
