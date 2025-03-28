// internal/repository/role_postgres.go
package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
)

type RoleRepository struct {
	db *sql.DB
}

func NewRoleRepository(db *sql.DB) *RoleRepository {
	return &RoleRepository{db: db}
}

func (r *RoleRepository) GetAll() ([]domain.Role, error) {
	query := "SELECT id, name, description FROM roles ORDER BY id"

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var role domain.Role
		err := rows.Scan(&role.ID, &role.Name, &role.Description)
		if err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *RoleRepository) GetByID(id int) (domain.Role, error) {
	var role domain.Role
	query := "SELECT id, name, description FROM roles WHERE id = $1"

	err := r.db.QueryRow(query, id).Scan(&role.ID, &role.Name, &role.Description)
	if err != nil {
		return domain.Role{}, err
	}

	return role, nil
}

func (r *RoleRepository) GetByName(name string) (domain.Role, error) {
	var role domain.Role
	query := "SELECT id, name, description FROM roles WHERE name = $1"

	err := r.db.QueryRow(query, name).Scan(&role.ID, &role.Name, &role.Description)
	if err != nil {
		return domain.Role{}, err
	}

	return role, nil
}

func (r *RoleRepository) GetPermissions(roleID int) ([]domain.Permission, error) {
	query := `
        SELECT p.id, p.code, p.description
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.id
    `

	rows, err := r.db.Query(query, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []domain.Permission
	for rows.Next() {
		var permission domain.Permission
		err := rows.Scan(&permission.ID, &permission.Code, &permission.Description)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}

	return permissions, nil
}
