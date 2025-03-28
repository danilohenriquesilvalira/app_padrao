// internal/repository/theme_postgres.go
package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"errors"
	"log"
)

type ThemeRepository struct {
	db *sql.DB
}

func NewThemeRepository(db *sql.DB) *ThemeRepository {
	return &ThemeRepository{db: db}
}

func (r *ThemeRepository) GetAll() ([]domain.Theme, error) {
	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		ORDER BY name
	`

	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("Erro ao buscar temas: %v", err)
		return nil, err
	}
	defer rows.Close()

	var themes []domain.Theme
	for rows.Next() {
		var theme domain.Theme
		err := rows.Scan(
			&theme.ID,
			&theme.Name,
			&theme.PrimaryColor,
			&theme.SecondaryColor,
			&theme.TextColor,
			&theme.BackgroundColor,
			&theme.AccentColor,
			&theme.IsDefault,
		)
		if err != nil {
			log.Printf("Erro ao escanear tema: %v", err)
			return nil, err
		}
		themes = append(themes, theme)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Erro após iteração dos temas: %v", err)
		return nil, err
	}

	return themes, nil
}

func (r *ThemeRepository) GetByID(id int) (domain.Theme, error) {
	var theme domain.Theme

	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE id = $1
	`

	err := r.db.QueryRow(query, id).Scan(
		&theme.ID,
		&theme.Name,
		&theme.PrimaryColor,
		&theme.SecondaryColor,
		&theme.TextColor,
		&theme.BackgroundColor,
		&theme.AccentColor,
		&theme.IsDefault,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Theme{}, domain.ErrThemeNotFound
		}
		log.Printf("Erro ao buscar tema por ID: %v", err)
		return domain.Theme{}, err
	}

	return theme, nil
}

func (r *ThemeRepository) GetByName(name string) (domain.Theme, error) {
	var theme domain.Theme

	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE name = $1
	`

	err := r.db.QueryRow(query, name).Scan(
		&theme.ID,
		&theme.Name,
		&theme.PrimaryColor,
		&theme.SecondaryColor,
		&theme.TextColor,
		&theme.BackgroundColor,
		&theme.AccentColor,
		&theme.IsDefault,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Theme{}, domain.ErrThemeNotFound
		}
		log.Printf("Erro ao buscar tema por nome: %v", err)
		return domain.Theme{}, err
	}

	return theme, nil
}

func (r *ThemeRepository) GetDefault() (domain.Theme, error) {
	var theme domain.Theme

	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE is_default = true
		LIMIT 1
	`

	err := r.db.QueryRow(query).Scan(
		&theme.ID,
		&theme.Name,
		&theme.PrimaryColor,
		&theme.SecondaryColor,
		&theme.TextColor,
		&theme.BackgroundColor,
		&theme.AccentColor,
		&theme.IsDefault,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Se não encontrar o tema padrão, criar um padrão hardcoded
			theme = domain.Theme{
				ID:              0,
				Name:            "Default",
				PrimaryColor:    "#4285F4",
				SecondaryColor:  "#34A853",
				TextColor:       "#202124",
				BackgroundColor: "#FFFFFF",
				AccentColor:     "#FBBC05",
				IsDefault:       true,
			}
			return theme, nil
		}
		log.Printf("Erro ao buscar tema padrão: %v", err)
		return domain.Theme{}, err
	}

	return theme, nil
}
