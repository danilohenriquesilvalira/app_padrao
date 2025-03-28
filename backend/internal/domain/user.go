// internal/domain/user.go
package domain

import "errors"

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"`
}

type UserRepository interface {
	Create(user User) (int, error)
	GetByID(id int) (User, error)
	GetByEmail(email string) (User, error)
}

type UserService interface {
	Register(user User) (int, error)
	GetByID(id int) (User, error)
	Login(email, password string) (string, User, error)
}

var (
	ErrUserNotFound       = errors.New("usuário não encontrado")
	ErrInvalidCredentials = errors.New("credenciais inválidas")
	ErrEmailInUse         = errors.New("email já em uso")
	ErrUsernameInUse      = errors.New("nome de usuário já em uso")
)
