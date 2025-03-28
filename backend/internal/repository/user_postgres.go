// internal/repository/user_postgres.go
package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"errors"
	"log"
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
		log.Printf("Erro ao criar usuário: %v", err)
		return 0, err
	}

	return id, nil
}

func (r *UserRepository) GetByID(id int) (domain.User, error) {
	var user domain.User
	var fullName, phone sql.NullString
	var lastLogin sql.NullTime

	query := `
        SELECT id, username, email, role, is_active, full_name, phone, last_login
        FROM users
        WHERE id = $1
    `

	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Role,
		&user.IsActive,
		&fullName,
		&phone,
		&lastLogin,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.User{}, domain.ErrUserNotFound
		}
		log.Printf("Erro ao buscar usuário por ID: %v", err)
		return domain.User{}, err
	}

	// Tratar valores nulos
	if fullName.Valid {
		user.FullName = fullName.String
	} else {
		user.FullName = ""
	}

	if phone.Valid {
		user.Phone = phone.String
	} else {
		user.Phone = ""
	}

	if lastLogin.Valid {
		user.LastLogin = lastLogin.Time.Format(time.RFC3339)
	} else {
		user.LastLogin = ""
	}

	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (domain.User, error) {
	var user domain.User
	var fullName, phone sql.NullString

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
		&fullName,
		&phone,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.User{}, domain.ErrUserNotFound
		}
		log.Printf("Erro ao buscar usuário por email: %v", err)
		return domain.User{}, err
	}

	// Tratar valores nulos
	if fullName.Valid {
		user.FullName = fullName.String
	} else {
		user.FullName = ""
	}

	if phone.Valid {
		user.Phone = phone.String
	} else {
		user.Phone = ""
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
		log.Printf("Erro ao atualizar usuário: %v", err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Erro ao obter linhas afetadas: %v", err)
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
		log.Printf("Erro ao excluir usuário: %v", err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Erro ao obter linhas afetadas: %v", err)
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrUserNotFound
	}

	return nil
}

func (r *UserRepository) List(page, pageSize int) ([]domain.User, int, error) {
	offset := (page - 1) * pageSize

	// Log para depuração
	log.Printf("Executando contagem de usuários")

	countQuery := "SELECT COUNT(*) FROM users"
	var total int
	err := r.db.QueryRow(countQuery).Scan(&total)
	if err != nil {
		log.Printf("Erro ao contar usuários: %v", err)
		return nil, 0, err
	}

	log.Printf("Total de usuários: %d", total)

	// Use COALESCE para garantir que valores NULL sejam convertidos para string vazia
	query := `
		SELECT 
			id, 
			username, 
			email, 
			role, 
			is_active, 
			COALESCE(full_name, '') as full_name, 
			COALESCE(phone, '') as phone
		FROM users
		ORDER BY id
		LIMIT $1 OFFSET $2
	`

	log.Printf("Executando consulta: LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		log.Printf("Erro na consulta SQL: %v", err)
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
			log.Printf("Erro ao escanear linha: %v", err)
			return nil, 0, err
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Erro após iteração de linhas: %v", err)
		return nil, 0, err
	}

	log.Printf("Usuários encontrados: %d", len(users))

	return users, total, nil
}

func (r *UserRepository) HasPermission(userID int, permissionCode string) (bool, error) {
	// Verificar role do usuário
	var role string
	query := "SELECT role FROM users WHERE id = $1"

	err := r.db.QueryRow(query, userID).Scan(&role)
	if err != nil {
		log.Printf("Erro ao verificar role do usuário %d: %v", userID, err)
		if errors.Is(err, sql.ErrNoRows) {
			return false, domain.ErrUserNotFound
		}
		return false, err
	}

	// Admin sempre tem permissão
	if role == "admin" {
		return true, nil
	}

	// Para outros usuários, verificar na tabela de permissões (implementação básica)
	// Na prática, implementaria a consulta real às permissões
	log.Printf("Verificando permissão %s para usuário %d com role %s", permissionCode, userID, role)

	// Solução temporária para teste
	return true, nil
}
