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
	// Verificar se a tabela themes existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'themes'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela themes existe: %v", err)
		return nil, err
	}

	// Se a tabela não existir, criá-la com valores padrão
	if !exists {
		log.Printf("Tabela themes não existe. Criando...")
		_, err = r.db.Exec(`
			CREATE TABLE IF NOT EXISTS themes (
				id SERIAL PRIMARY KEY,
				name VARCHAR(50) NOT NULL UNIQUE,
				primary_color VARCHAR(50) NOT NULL,
				secondary_color VARCHAR(50) NOT NULL,
				text_color VARCHAR(50) NOT NULL,
				background_color VARCHAR(50) NOT NULL,
				accent_color VARCHAR(50) NOT NULL,
				is_default BOOLEAN DEFAULT false
			)
		`)
		if err != nil {
			log.Printf("Erro ao criar tabela themes: %v", err)
			return nil, err
		}

		// Inserir temas padrão
		_, err = r.db.Exec(`
			INSERT INTO themes (name, primary_color, secondary_color, text_color, background_color, accent_color, is_default)
			VALUES 
				('default', '#4285F4', '#34A853', '#202124', '#FFFFFF', '#FBBC05', true),
				('dark', '#333333', '#555555', '#FFFFFF', '#121212', '#BB86FC', false),
				('blue', '#3498db', '#2980b9', '#333333', '#ecf0f1', '#e74c3c', false),
				('green', '#2ecc71', '#27ae60', '#333333', '#ecf0f1', '#e67e22', false)
		`)
		if err != nil {
			log.Printf("Erro ao inserir temas padrão: %v", err)
			// Continuar mesmo com erro, para retornar os temas padrão
		}
	}

	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		ORDER BY name
	`

	rows, err := r.db.Query(query)
	if err != nil {
		log.Printf("Erro ao buscar temas: %v", err)
		return getDefaultThemes(), nil
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
			continue // Pular este tema e continuar com os próximos
		}
		themes = append(themes, theme)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Erro após iteração dos temas: %v", err)
	}

	// Se não encontrou nenhum tema, retornar os padrões
	if len(themes) == 0 {
		return getDefaultThemes(), nil
	}

	return themes, nil
}

func (r *ThemeRepository) GetByID(id int) (domain.Theme, error) {
	// Verificar se a tabela themes existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'themes'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela themes existe: %v", err)
		return getDefaultTheme(), err
	}

	// Se a tabela não existir, retornar tema padrão
	if !exists {
		return getDefaultTheme(), nil
	}

	var theme domain.Theme
	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE id = $1
	`

	err = r.db.QueryRow(query, id).Scan(
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
			return getDefaultTheme(), domain.ErrThemeNotFound
		}
		log.Printf("Erro ao buscar tema por ID: %v", err)
		return getDefaultTheme(), err
	}

	return theme, nil
}

func (r *ThemeRepository) GetByName(name string) (domain.Theme, error) {
	// Se o nome for vazio ou "default", retornar o tema padrão diretamente
	if name == "" || name == "default" {
		return getDefaultTheme(), nil
	}

	// Verificar se a tabela themes existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'themes'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela themes existe: %v", err)
		return getDefaultTheme(), err
	}

	// Se a tabela não existir, retornar tema padrão
	if !exists {
		return getDefaultTheme(), nil
	}

	var theme domain.Theme
	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE name = $1
	`

	err = r.db.QueryRow(query, name).Scan(
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
			return getDefaultTheme(), domain.ErrThemeNotFound
		}
		log.Printf("Erro ao buscar tema por nome: %v", err)
		return getDefaultTheme(), err
	}

	return theme, nil
}

func (r *ThemeRepository) GetDefault() (domain.Theme, error) {
	// Verificar se a tabela themes existe
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'themes'
		)
	`).Scan(&exists)

	if err != nil {
		log.Printf("Erro ao verificar se a tabela themes existe: %v", err)
		return getDefaultTheme(), err
	}

	// Se a tabela não existir, retornar tema padrão
	if !exists {
		return getDefaultTheme(), nil
	}

	var theme domain.Theme
	query := `
		SELECT id, name, primary_color, secondary_color, text_color, background_color, accent_color, is_default
		FROM themes
		WHERE is_default = true
		LIMIT 1
	`

	err = r.db.QueryRow(query).Scan(
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
			// Se não encontrar o tema padrão, retornar o default hardcoded
			return getDefaultTheme(), nil
		}
		log.Printf("Erro ao buscar tema padrão: %v", err)
		return getDefaultTheme(), err
	}

	return theme, nil
}

// Funções auxiliares para retornar temas padrão hardcoded
func getDefaultTheme() domain.Theme {
	return domain.Theme{
		ID:              1,
		Name:            "default",
		PrimaryColor:    "#4285F4",
		SecondaryColor:  "#34A853",
		TextColor:       "#202124",
		BackgroundColor: "#FFFFFF",
		AccentColor:     "#FBBC05",
		IsDefault:       true,
	}
}

func getDefaultThemes() []domain.Theme {
	return []domain.Theme{
		{
			ID:              1,
			Name:            "default",
			PrimaryColor:    "#4285F4",
			SecondaryColor:  "#34A853",
			TextColor:       "#202124",
			BackgroundColor: "#FFFFFF",
			AccentColor:     "#FBBC05",
			IsDefault:       true,
		},
		{
			ID:              2,
			Name:            "dark",
			PrimaryColor:    "#333333",
			SecondaryColor:  "#555555",
			TextColor:       "#FFFFFF",
			BackgroundColor: "#121212",
			AccentColor:     "#BB86FC",
			IsDefault:       false,
		},
		{
			ID:              3,
			Name:            "blue",
			PrimaryColor:    "#3498db",
			SecondaryColor:  "#2980b9",
			TextColor:       "#333333",
			BackgroundColor: "#ecf0f1",
			AccentColor:     "#e74c3c",
			IsDefault:       false,
		},
		{
			ID:              4,
			Name:            "green",
			PrimaryColor:    "#2ecc71",
			SecondaryColor:  "#27ae60",
			TextColor:       "#333333",
			BackgroundColor: "#ecf0f1",
			AccentColor:     "#e67e22",
			IsDefault:       false,
		},
	}
}
