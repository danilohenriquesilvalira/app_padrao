// internal/domain/user.go
package domain

import "errors"

type User struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password,omitempty"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
	FullName  string `json:"full_name"`
	Phone     string `json:"phone"`
	LastLogin string `json:"last_login"`
}

type UserRepository interface {
	Create(user User) (int, error)
	GetByID(id int) (User, error)
	GetByEmail(email string) (User, error)
	Update(user User) error
	Delete(id int) error
	List(page, pageSize int) ([]User, int, error)
	HasPermission(userID int, permissionCode string) (bool, error)
	UpdateLastLogin(userID int) error // Novo método
}

type UserService interface {
	Register(user User) (int, error)
	GetByID(id int) (User, error)
	Login(email, password string) (string, User, error)
	Update(user User) error
	Delete(id int) error
	List(page, pageSize int) ([]User, int, error)
	HasPermission(userID int, permissionCode string) (bool, error)
}

// Erros comuns
var (
	ErrUserNotFound       = errors.New("usuário não encontrado")
	ErrInvalidCredentials = errors.New("credenciais inválidas")
	ErrEmailInUse         = errors.New("email já em uso")
	ErrUsernameInUse      = errors.New("nome de usuário já em uso")
)
