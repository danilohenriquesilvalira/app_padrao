package repository

import (
	"app_padrao/internal/domain"
	"database/sql"
	"errors"
	"time"
)

type PLCTagRepository struct {
	db *sql.DB
}

func NewPLCTagRepository(db *sql.DB) *PLCTagRepository {
	return &PLCTagRepository{db: db}
}

func (r *PLCTagRepository) GetByID(id int) (domain.PLCTag, error) {
	query := `
		SELECT id, plc_id, name, description, db_number, byte_offset, data_type,
			   scan_rate, monitor_changes, can_write, active, created_at, updated_at
		FROM plc_tags
		WHERE id = $1
	`

	var tag domain.PLCTag
	var updatedAt sql.NullTime
	var description sql.NullString

	err := r.db.QueryRow(query, id).Scan(
		&tag.ID,
		&tag.PLCID,
		&tag.Name,
		&description,
		&tag.DBNumber,
		&tag.ByteOffset,
		&tag.DataType,
		&tag.ScanRate,
		&tag.MonitorChanges,
		&tag.CanWrite,
		&tag.Active,
		&tag.CreatedAt,
		&updatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.PLCTag{}, domain.ErrPLCTagNotFound
		}
		return domain.PLCTag{}, err
	}

	if description.Valid {
		tag.Description = description.String
	}

	if updatedAt.Valid {
		tag.UpdatedAt = updatedAt.Time
	}

	return tag, nil
}

func (r *PLCTagRepository) GetByName(name string) ([]domain.PLCTag, error) {
	query := `
		SELECT id, plc_id, name, description, db_number, byte_offset, data_type,
			   scan_rate, monitor_changes, can_write, active, created_at, updated_at
		FROM plc_tags
		WHERE name = $1
	`

	rows, err := r.db.Query(query, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []domain.PLCTag
	for rows.Next() {
		var tag domain.PLCTag
		var updatedAt sql.NullTime
		var description sql.NullString

		err := rows.Scan(
			&tag.ID,
			&tag.PLCID,
			&tag.Name,
			&description,
			&tag.DBNumber,
			&tag.ByteOffset,
			&tag.DataType,
			&tag.ScanRate,
			&tag.MonitorChanges,
			&tag.CanWrite,
			&tag.Active,
			&tag.CreatedAt,
			&updatedAt,
		)

		if err != nil {
			return nil, err
		}

		if description.Valid {
			tag.Description = description.String
		}

		if updatedAt.Valid {
			tag.UpdatedAt = updatedAt.Time
		}

		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return tags, nil
}

func (r *PLCTagRepository) GetPLCTags(plcID int) ([]domain.PLCTag, error) {
	query := `
		SELECT id, plc_id, name, description, db_number, byte_offset, data_type,
			   scan_rate, monitor_changes, can_write, active, created_at, updated_at
		FROM plc_tags
		WHERE plc_id = $1
		ORDER BY name
	`

	rows, err := r.db.Query(query, plcID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []domain.PLCTag
	for rows.Next() {
		var tag domain.PLCTag
		var updatedAt sql.NullTime
		var description sql.NullString

		err := rows.Scan(
			&tag.ID,
			&tag.PLCID,
			&tag.Name,
			&description,
			&tag.DBNumber,
			&tag.ByteOffset,
			&tag.DataType,
			&tag.ScanRate,
			&tag.MonitorChanges,
			&tag.CanWrite,
			&tag.Active,
			&tag.CreatedAt,
			&updatedAt,
		)

		if err != nil {
			return nil, err
		}

		if description.Valid {
			tag.Description = description.String
		}

		if updatedAt.Valid {
			tag.UpdatedAt = updatedAt.Time
		}

		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return tags, nil
}

func (r *PLCTagRepository) Create(tag domain.PLCTag) (int, error) {
	query := `
		INSERT INTO plc_tags (
			plc_id, name, description, db_number, byte_offset, data_type,
			scan_rate, monitor_changes, can_write, active, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`

	var id int
	err := r.db.QueryRow(
		query,
		tag.PLCID,
		tag.Name,
		tag.Description,
		tag.DBNumber,
		tag.ByteOffset,
		tag.DataType,
		tag.ScanRate,
		tag.MonitorChanges,
		tag.CanWrite,
		tag.Active,
		tag.CreatedAt,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	return id, nil
}

func (r *PLCTagRepository) Update(tag domain.PLCTag) error {
	query := `
		UPDATE plc_tags
		SET plc_id = $1, name = $2, description = $3, db_number = $4, byte_offset = $5,
			data_type = $6, scan_rate = $7, monitor_changes = $8, can_write = $9,
			active = $10, updated_at = $11
		WHERE id = $12
	`

	result, err := r.db.Exec(
		query,
		tag.PLCID,
		tag.Name,
		tag.Description,
		tag.DBNumber,
		tag.ByteOffset,
		tag.DataType,
		tag.ScanRate,
		tag.MonitorChanges,
		tag.CanWrite,
		tag.Active,
		time.Now(),
		tag.ID,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrPLCTagNotFound
	}

	return nil
}

func (r *PLCTagRepository) Delete(id int) error {
	query := "DELETE FROM plc_tags WHERE id = $1"

	result, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return domain.ErrPLCTagNotFound
	}

	return nil
}
