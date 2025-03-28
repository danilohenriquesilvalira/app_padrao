// internal/repository/profile_postgres.go
package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"time"
)

type ProfileRepository struct {
	db *sql.DB
}

func NewProfileRepository(db *sql.DB) *ProfileRepository {
	return &ProfileRepository{db: db}
}

func (r *ProfileRepository) Create(profile domain.Profile) (int, error) {
	// Tratamento seguro para NotificationPreferences
	var notificationJSON []byte
	var err error

	if profile.NotificationPreferences == nil {
		// Valor padrão se for nulo
		profile.NotificationPreferences = map[string]bool{
			"email": true,
			"push":  true,
			"sms":   false,
		}
	}

	// Converter map para JSON
	notificationJSON, err = json.Marshal(profile.NotificationPreferences)
	if err != nil {
		log.Printf("Erro ao converter notificações para JSON: %v", err)
		// Usar JSON padrão em caso de erro
		notificationJSON = []byte(`{"email":true,"push":true,"sms":false}`)
	}

	// Garantir que os campos opcionais tenham valores padrão
	if profile.Theme == "" {
		profile.Theme = "default"
	}

	if profile.FontSize == "" {
		profile.FontSize = "medium"
	}

	if profile.Language == "" {
		profile.Language = "pt_BR"
	}

	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = time.Now()
	}

	// Verificar se a tabela profiles existe
	var exists bool
	err = r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'profiles'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela profiles existe: %v", err)
		return 0, err
	}

	// Se a tabela não existir, criá-la - CORRIGIDO: sem coluna ID
	if !exists {
		log.Printf("Tabela profiles não existe. Criando...")
		_, err = r.db.Exec(`
			CREATE TABLE IF NOT EXISTS profiles (
				user_id INTEGER NOT NULL PRIMARY KEY,
				avatar_url TEXT,
				bio TEXT,
				department VARCHAR(100),
				notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
				theme VARCHAR(50) DEFAULT 'default',
				font_size VARCHAR(20) DEFAULT 'medium',
				language VARCHAR(10) DEFAULT 'pt_BR',
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP
			)
		`)
		if err != nil {
			log.Printf("Erro ao criar tabela profiles: %v", err)
			return 0, err
		}
	}

	// CORRIGIDO: Removida referência à coluna ID
	query := `
		INSERT INTO profiles 
		(user_id, avatar_url, bio, department, theme, font_size, language, notification_preferences, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id) 
		DO UPDATE SET
			avatar_url = EXCLUDED.avatar_url,
			bio = EXCLUDED.bio,
			department = EXCLUDED.department,
			theme = EXCLUDED.theme,
			font_size = EXCLUDED.font_size,
			language = EXCLUDED.language,
			notification_preferences = EXCLUDED.notification_preferences,
			updated_at = EXCLUDED.updated_at
		RETURNING user_id
	`

	var userID int
	err = r.db.QueryRow(
		query,
		profile.UserID,
		profile.AvatarURL,
		profile.Bio,
		profile.Department,
		profile.Theme,
		profile.FontSize,
		profile.Language,
		notificationJSON,
		profile.CreatedAt,
		profile.UpdatedAt,
	).Scan(&userID)

	if err != nil {
		log.Printf("Erro ao salvar perfil: %v", err)
		return 0, err
	}

	return userID, nil
}

func (r *ProfileRepository) GetByUserID(userID int) (domain.Profile, error) {
	// Verificar se a tabela profiles existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'profiles'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela profiles existe: %v", err)
		return domain.Profile{}, err
	}

	// Se a tabela não existir, retornar erro ErrProfileNotFound
	if !exists {
		log.Printf("Tabela profiles não existe.")
		return domain.Profile{}, domain.ErrProfileNotFound
	}

	// Perfil padrão com valores seguros
	defaultProfile := domain.Profile{
		UserID:                  userID,
		AvatarURL:               "",
		Bio:                     "",
		Department:              "",
		Theme:                   "default",
		FontSize:                "medium",
		Language:                "pt_BR",
		NotificationPreferences: map[string]bool{"email": true, "push": true, "sms": false},
		CreatedAt:               time.Now(),
	}

	var profile domain.Profile
	var avatarURL, bio, theme, fontSize, language, department sql.NullString
	var notificationJSON sql.NullString
	var createdAt, updatedAt sql.NullTime

	// CORRIGIDO: Removida referência à coluna ID
	query := `
		SELECT user_id, avatar_url, bio, department, theme, font_size, language, 
		       notification_preferences, created_at, updated_at
		FROM profiles
		WHERE user_id = $1
	`

	err = r.db.QueryRow(query, userID).Scan(
		&profile.UserID,
		&avatarURL,
		&bio,
		&department,
		&theme,
		&fontSize,
		&language,
		&notificationJSON,
		&createdAt,
		&updatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Perfil não encontrado, retornar erro específico
			return defaultProfile, domain.ErrProfileNotFound
		}
		log.Printf("Erro ao buscar perfil: %v", err)
		return defaultProfile, err
	}

	// Converter valores de SQL para Go, com tratamento seguro para nulos
	if avatarURL.Valid {
		profile.AvatarURL = avatarURL.String
	}

	if bio.Valid {
		profile.Bio = bio.String
	}

	if department.Valid {
		profile.Department = department.String
	}

	if theme.Valid {
		profile.Theme = theme.String
	} else {
		profile.Theme = "default"
	}

	if fontSize.Valid {
		profile.FontSize = fontSize.String
	} else {
		profile.FontSize = "medium"
	}

	if language.Valid {
		profile.Language = language.String
	} else {
		profile.Language = "pt_BR"
	}

	// Processar JSON de notificações
	if notificationJSON.Valid {
		var notifications map[string]bool
		err = json.Unmarshal([]byte(notificationJSON.String), &notifications)
		if err == nil {
			profile.NotificationPreferences = notifications
		} else {
			// Valor padrão em caso de erro
			profile.NotificationPreferences = map[string]bool{
				"email": true,
				"push":  true,
				"sms":   false,
			}
		}
	} else {
		// Valor padrão para preferências nulas
		profile.NotificationPreferences = map[string]bool{
			"email": true,
			"push":  true,
			"sms":   false,
		}
	}

	if createdAt.Valid {
		profile.CreatedAt = createdAt.Time
	} else {
		profile.CreatedAt = time.Now()
	}

	if updatedAt.Valid {
		profile.UpdatedAt = updatedAt.Time
	}

	return profile, nil
}

func (r *ProfileRepository) Update(profile domain.Profile) error {
	// Verificar se a tabela profiles existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'profiles'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela profiles existe: %v", err)
		return err
	}

	// Se a tabela não existir, criá-la - CORRIGIDO: sem coluna ID
	if !exists {
		log.Printf("Tabela profiles não existe. Criando...")
		_, err = r.db.Exec(`
			CREATE TABLE IF NOT EXISTS profiles (
				user_id INTEGER NOT NULL PRIMARY KEY,
				avatar_url TEXT,
				bio TEXT,
				department VARCHAR(100),
				notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
				theme VARCHAR(50) DEFAULT 'default',
				font_size VARCHAR(20) DEFAULT 'medium',
				language VARCHAR(10) DEFAULT 'pt_BR',
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP
			)
		`)
		if err != nil {
			log.Printf("Erro ao criar tabela profiles: %v", err)
			return err
		}
	}

	// Tratamento seguro para NotificationPreferences
	var notificationJSON []byte

	if profile.NotificationPreferences == nil {
		// Valor padrão se for nulo
		profile.NotificationPreferences = map[string]bool{
			"email": true,
			"push":  true,
			"sms":   false,
		}
	}

	// Converter map para JSON
	notificationJSON, err = json.Marshal(profile.NotificationPreferences)
	if err != nil {
		log.Printf("Erro ao converter notificações para JSON: %v", err)
		// Usar JSON padrão em caso de erro
		notificationJSON = []byte(`{"email":true,"push":true,"sms":false}`)
	}

	// Garantir valores padrão para campos opcionais
	if profile.Theme == "" {
		profile.Theme = "default"
	}

	if profile.FontSize == "" {
		profile.FontSize = "medium"
	}

	if profile.Language == "" {
		profile.Language = "pt_BR"
	}

	if profile.UpdatedAt.IsZero() {
		profile.UpdatedAt = time.Now()
	}

	// Usar UPSERT para criar ou atualizar - CORRIGIDO: user_id como identificador
	query := `
		INSERT INTO profiles 
		(user_id, avatar_url, bio, department, theme, font_size, language, notification_preferences, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id) 
		DO UPDATE SET
			avatar_url = EXCLUDED.avatar_url,
			bio = EXCLUDED.bio,
			department = EXCLUDED.department,
			theme = EXCLUDED.theme,
			font_size = EXCLUDED.font_size,
			language = EXCLUDED.language,
			notification_preferences = EXCLUDED.notification_preferences,
			updated_at = EXCLUDED.updated_at
	`

	_, err = r.db.Exec(
		query,
		profile.UserID,
		profile.AvatarURL,
		profile.Bio,
		profile.Department,
		profile.Theme,
		profile.FontSize,
		profile.Language,
		notificationJSON,
		profile.CreatedAt,
		profile.UpdatedAt,
	)

	if err != nil {
		log.Printf("Erro ao atualizar perfil: %v", err)
		return err
	}

	return nil
}

func (r *ProfileRepository) Delete(id int) error {
	query := "DELETE FROM profiles WHERE user_id = $1"

	// Verificar se a tabela profiles existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'profiles'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela profiles existe: %v", err)
		return err
	}

	// Se a tabela não existir, não precisamos excluir nada
	if !exists {
		return nil
	}

	result, err := r.db.Exec(query, id)
	if err != nil {
		log.Printf("Erro ao excluir perfil: %v", err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Erro ao obter linhas afetadas: %v", err)
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrProfileNotFound
	}

	return nil
}
