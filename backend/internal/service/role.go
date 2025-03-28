// internal/service/role.go
package service

import (
	"app_padrao/internal/domain"
)

type RoleService struct {
	repo domain.RoleRepository
}

func NewRoleService(repo domain.RoleRepository) *RoleService {
	return &RoleService{repo: repo}
}

func (s *RoleService) GetAll() ([]domain.Role, error) {
	return s.repo.GetAll()
}

func (s *RoleService) GetByID(id int) (domain.Role, error) {
	return s.repo.GetByID(id)
}

func (s *RoleService) GetByName(name string) (domain.Role, error) {
	return s.repo.GetByName(name)
}

func (s *RoleService) GetPermissions(roleID int) ([]domain.Permission, error) {
	return s.repo.GetPermissions(roleID)
}
