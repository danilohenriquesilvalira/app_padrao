package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"errors"
	"time"
)

type PLCRepository struct {
	db *sql.DB
}

func NewPLCRepository(db *sql.DB) *PLCRepository {
	return &PLCRepository{db: db}
}

func (r *PLCRepository) GetByID(id int) (domain.PLC, error) {
	query := `
		SELECT p.id, p.name, p.ip_address, p.rack, p.slot, p.active, p.created_at, p.updated_at,
			COALESCE(s.status, 'unknown') as status
		FROM plcs p 
		LEFT JOIN plc_status s ON p.id = s.plc_id
		WHERE p.id = $1
	`

	var plc domain.PLC
	var updatedAt sql.NullTime
	var status sql.NullString

	err := r.db.QueryRow(query, id).Scan(
		&plc.ID,
		&plc.Name,
		&plc.IPAddress,
		&plc.Rack,
		&plc.Slot,
		&plc.Active,
		&plc.CreatedAt,
		&updatedAt,
		&status,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.PLC{}, domain.ErrPLCNotFound
		}
		return domain.PLC{}, err
	}

	if updatedAt.Valid {
		plc.UpdatedAt = updatedAt.Time
	}

	if status.Valid {
		plc.Status = status.String
	} else {
		plc.Status = "unknown"
	}

	return plc, nil
}

func (r *PLCRepository) GetAll() ([]domain.PLC, error) {
	query := `
		SELECT p.id, p.name, p.ip_address, p.rack, p.slot, p.active, p.created_at, p.updated_at,
			COALESCE(s.status, 'unknown') as status
		FROM plcs p 
		LEFT JOIN plc_status s ON p.id = s.plc_id
		ORDER BY p.name
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plcs []domain.PLC
	for rows.Next() {
		var plc domain.PLC
		var updatedAt sql.NullTime
		var status sql.NullString

		err := rows.Scan(
			&plc.ID,
			&plc.Name,
			&plc.IPAddress,
			&plc.Rack,
			&plc.Slot,
			&plc.Active,
			&plc.CreatedAt,
			&updatedAt,
			&status,
		)

		if err != nil {
			return nil, err
		}

		if updatedAt.Valid {
			plc.UpdatedAt = updatedAt.Time
		}

		if status.Valid {
			plc.Status = status.String
		} else {
			plc.Status = "unknown"
		}

		plcs = append(plcs, plc)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return plcs, nil
}

func (r *PLCRepository) GetActivePLCs() ([]domain.PLC, error) {
	query := `
		SELECT p.id, p.name, p.ip_address, p.rack, p.slot, p.active, p.created_at, p.updated_at,
			COALESCE(s.status, 'unknown') as status
		FROM plcs p 
		LEFT JOIN plc_status s ON p.id = s.plc_id
		WHERE p.active = true
		ORDER BY p.name
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plcs []domain.PLC
	for rows.Next() {
		var plc domain.PLC
		var updatedAt sql.NullTime
		var status sql.NullString

		err := rows.Scan(
			&plc.ID,
			&plc.Name,
			&plc.IPAddress,
			&plc.Rack,
			&plc.Slot,
			&plc.Active,
			&plc.CreatedAt,
			&updatedAt,
			&status,
		)

		if err != nil {
			return nil, err
		}

		if updatedAt.Valid {
			plc.UpdatedAt = updatedAt.Time
		}

		if status.Valid {
			plc.Status = status.String
		} else {
			plc.Status = "unknown"
		}

		plcs = append(plcs, plc)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return plcs, nil
}

func (r *PLCRepository) Create(plc domain.PLC) (int, error) {
	query := `
		INSERT INTO plcs (name, ip_address, rack, slot, active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	var id int
	err := r.db.QueryRow(
		query,
		plc.Name,
		plc.IPAddress,
		plc.Rack,
		plc.Slot,
		plc.Active,
		plc.CreatedAt,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	// Inserir status inicial
	statusQuery := `
		INSERT INTO plc_status (plc_id, status, last_update)
		VALUES ($1, $2, $3)
		ON CONFLICT (plc_id) DO UPDATE
		SET status = EXCLUDED.status, last_update = EXCLUDED.last_update
	`

	_, err = r.db.Exec(statusQuery, id, "unknown", time.Now())
	if err != nil {
		return id, err // Retornamos o ID mesmo com erro no status
	}

	return id, nil
}

func (r *PLCRepository) Update(plc domain.PLC) error {
	query := `
		UPDATE plcs
		SET name = $1, ip_address = $2, rack = $3, slot = $4, active = $5, updated_at = $6
		WHERE id = $7
	`

	result, err := r.db.Exec(
		query,
		plc.Name,
		plc.IPAddress,
		plc.Rack,
		plc.Slot,
		plc.Active,
		time.Now(),
		plc.ID,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrPLCNotFound
	}

	return nil
}

func (r *PLCRepository) Delete(id int) error {
	// Remover o status primeiro (devido à chave estrangeira)
	_, err := r.db.Exec("DELETE FROM plc_status WHERE plc_id = $1", id)
	if err != nil {
		return err
	}

	// Agora remove o PLC
	result, err := r.db.Exec("DELETE FROM plcs WHERE id = $1", id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrPLCNotFound
	}

	return nil
}

func (r *PLCRepository) UpdatePLCStatus(status domain.PLCStatus) error {
	query := `
		INSERT INTO plc_status (plc_id, status, last_update)
		VALUES ($1, $2, $3)
		ON CONFLICT (plc_id) DO UPDATE
		SET status = EXCLUDED.status, last_update = EXCLUDED.last_update
	`

	_, err := r.db.Exec(query, status.PLCID, status.Status, status.LastUpdate)
	return err
}
