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
	var id int

	// Converter map para JSON
	notificationJSON, err := json.Marshal(profile.NotificationPreferences)
	if err != nil {
		return 0, err
	}

	query := `
		INSERT INTO profiles (user_id, avatar_url, bio, theme, font_size, language, notification_preferences, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING user_id
	`

	err = r.db.QueryRow(
		query,
		profile.UserID,
		profile.AvatarURL,
		profile.Bio,
		profile.Theme,
		profile.FontSize,
		profile.Language,
		notificationJSON,
		profile.CreatedAt,
		profile.UpdatedAt,
	).Scan(&id)

	if err != nil {
		log.Printf("Erro ao criar perfil: %v", err)
		return 0, err
	}

	return id, nil
}

func (r *ProfileRepository) GetByUserID(userID int) (domain.Profile, error) {
	var profile domain.Profile
	var avatarURL, bio, theme, fontSize, language sql.NullString
	var notificationJSON sql.NullString
	var createdAt, updatedAt sql.NullTime

	query := `
		SELECT user_id, avatar_url, bio, theme, font_size, language, notification_preferences, created_at, updated_at
		FROM profiles
		WHERE user_id = $1
	`

	err := r.db.QueryRow(query, userID).Scan(
		&profile.UserID,
		&avatarURL,
		&bio,
		&theme,
		&fontSize,
		&language,
		&notificationJSON,
		&createdAt,
		&updatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Profile{}, domain.ErrProfileNotFound
		}
		log.Printf("Erro ao buscar perfil: %v", err)
		return domain.Profile{}, err
	}

	// Processar valores nulos
	if avatarURL.Valid {
		profile.AvatarURL = avatarURL.String
	}

	if bio.Valid {
		profile.Bio = bio.String
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
			profile.NotificationPreferences = map[string]bool{
				"email": true,
				"push":  true,
				"sms":   false,
			}
		}
	} else {
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
	// Converter map para JSON
	notificationJSON, err := json.Marshal(profile.NotificationPreferences)
	if err != nil {
		return err
	}

	query := `
		UPDATE profiles
		SET avatar_url = $1, bio = $2, theme = $3, font_size = $4, language = $5, notification_preferences = $6, updated_at = $7
		WHERE user_id = $8
	`

	result, err := r.db.Exec(
		query,
		profile.AvatarURL,
		profile.Bio,
		profile.Theme,
		profile.FontSize,
		profile.Language,
		notificationJSON,
		profile.UpdatedAt,
		profile.UserID,
	)

	if err != nil {
		log.Printf("Erro ao atualizar perfil: %v", err)
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

func (r *ProfileRepository) Delete(id int) error {
	query := "DELETE FROM profiles WHERE user_id = $1"

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
