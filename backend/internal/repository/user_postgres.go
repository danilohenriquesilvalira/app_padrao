// internal/repository/user_postgres.go
package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"errors"
	"time"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user domain.User) (int, error) {
	var id int
	query := `
        INSERT INTO users (username, email, password, role, is_active, full_name, phone) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id
    `

	err := r.db.QueryRow(
		query,
		user.Username,
		user.Email,
		user.Password,
		user.Role,
		user.IsActive,
		user.FullName,
		user.Phone,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	return id, nil
}

func (r *UserRepository) GetByID(id int) (domain.User, error) {
	var user domain.User
	query := `
        SELECT id, username, email, role, is_active, full_name, phone, last_login
        FROM users
        WHERE id = $1
    `

	var lastLogin sql.NullTime

	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Role,
		&user.IsActive,
		&user.FullName,
		&user.Phone,
		&lastLogin,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.User{}, domain.ErrUserNotFound
		}
		return domain.User{}, err
	}

	if lastLogin.Valid {
		user.LastLogin = lastLogin.Time.Format(time.RFC3339)
	}

	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (domain.User, error) {
	var user domain.User
	query := `
        SELECT id, username, email, password, role, is_active, full_name, phone
        FROM users
        WHERE email = $1
    `

	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Password,
		&user.Role,
		&user.IsActive,
		&user.FullName,
		&user.Phone,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.User{}, domain.ErrUserNotFound
		}
		return domain.User{}, err
	}

	return user, nil
}

func (r *UserRepository) Update(user domain.User) error {
	query := `
        UPDATE users
        SET username = $1, email = $2, role = $3, is_active = $4, full_name = $5, phone = $6
        WHERE id = $7
    `

	result, err := r.db.Exec(
		query,
		user.Username,
		user.Email,
		user.Role,
		user.IsActive,
		user.FullName,
		user.Phone,
		user.ID,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrUserNotFound
	}

	return nil
}

func (r *UserRepository) Delete(id int) error {
	query := "DELETE FROM users WHERE id = $1"

	result, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrUserNotFound
	}

	return nil
}

func (r *UserRepository) List(page, pageSize int) ([]domain.User, int, error) {
	offset := (page - 1) * pageSize

	countQuery := "SELECT COUNT(*) FROM users"
	var total int
	err := r.db.QueryRow(countQuery).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
        SELECT id, username, email, role, is_active, full_name, phone
        FROM users
        ORDER BY id
        LIMIT $1 OFFSET $2
    `

	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var user domain.User
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
			&user.Role,
			&user.IsActive,
			&user.FullName,
			&user.Phone,
		)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}

	return users, total, nil
}

func (r *UserRepository) HasPermission(userID int, permissionCode string) (bool, error) {
	// Solução temporária para teste
	return true, nil
}
