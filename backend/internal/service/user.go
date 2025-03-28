// internal/service/user.go
package service

import (
	"app_padrao/internal/domain"
	"app_padrao/pkg/jwt"

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

	// Gerar token JWT
	token, err := jwt.GenerateToken(user.ID, s.jwtSecretKey, s.expirationHrs)
	if err != nil {
		return "", domain.User{}, err
	}

	// Não retornar a senha
	user.Password = ""

	return token, user, nil
}
