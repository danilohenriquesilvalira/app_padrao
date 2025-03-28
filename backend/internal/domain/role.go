// internal/domain/role.go
package domain

type Role struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Permission struct {
	ID          int    `json:"id"`
	Code        string `json:"code"`
	Description string `json:"description"`
}

type RoleRepository interface {
	GetAll() ([]Role, error)
	GetByID(id int) (Role, error)
	GetByName(name string) (Role, error)
	GetPermissions(roleID int) ([]Permission, error)
}

type RoleService interface {
	GetAll() ([]Role, error)
	GetByID(id int) (Role, error)
	GetByName(name string) (Role, error)
	GetPermissions(roleID int) ([]Permission, error)
}
