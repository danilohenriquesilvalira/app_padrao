// internal/service/user.go
package service

import (
	"app_padrao/internal/domain"
	"app_padrao/pkg/jwt"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	repo          domain.UserRepository
	jwtSecretKey  string
	expirationHrs int
}

func NewUserService(repo domain.UserRepository, jwtKey string, expHours int) *UserService {
	return &UserService{
		repo:          repo,
		jwtSecretKey:  jwtKey,
		expirationHrs: expHours,
	}
}

func (s *UserService) Register(user domain.User) (int, error) {
	// Verificar se email já existe
	_, err := s.repo.GetByEmail(user.Email)
	if err == nil {
		return 0, domain.ErrEmailInUse
	} else if err != domain.ErrUserNotFound {
		return 0, err
	}

	// Hash da senha
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}

	user.Password = string(hashedPassword)

	// Valores padrão - apenas se não fornecidos
	if user.Role == "" {
		user.Role = "user"
	}

	// Não sobrescrever isActive se já tiver um valor definido
	if user.Role == "admin" {
		// Garantir que admins sempre estejam ativos por segurança
		user.IsActive = true
	} else if !user.IsActive {
		// Definir como true se não estiver explicitamente definido como false
		user.IsActive = true
	}

	return s.repo.Create(user)
}

func (s *UserService) GetByID(id int) (domain.User, error) {
	return s.repo.GetByID(id)
}

func (s *UserService) Login(email, password string) (string, domain.User, error) {
	user, err := s.repo.GetByEmail(email)
	if err != nil {
		return "", domain.User{}, domain.ErrInvalidCredentials
	}

	// Verificar senha
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", domain.User{}, domain.ErrInvalidCredentials
	}

	// Verificar se usuário está ativo
	if !user.IsActive {
		return "", domain.User{}, domain.ErrInvalidCredentials
	}

	// Atualizar last_login
	err = s.repo.UpdateLastLogin(user.ID)
	if err != nil {
		log.Printf("Erro ao atualizar last_login: %v", err)
		// Não falhar o login por causa disso
	}

	// Gerar token JWT
	token, err := jwt.GenerateToken(user.ID, s.jwtSecretKey, s.expirationHrs)
	if err != nil {
		return "", domain.User{}, err
	}

	// Atualizar LastLogin no objeto para retornar ao frontend
	currentTime := time.Now()
	user.LastLogin = currentTime.Format(time.RFC3339)

	// Não retornar a senha
	user.Password = ""

	return token, user, nil
}

func (s *UserService) Update(user domain.User) error {
	return s.repo.Update(user)
}

func (s *UserService) Delete(id int) error {
	return s.repo.Delete(id)
}

func (s *UserService) List(page, pageSize int) ([]domain.User, int, error) {
	return s.repo.List(page, pageSize)
}

func (s *UserService) HasPermission(userID int, permissionCode string) (bool, error) {
	return s.repo.HasPermission(userID, permissionCode)
}
