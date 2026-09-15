package project

import (
	"database/sql"
	"errors"
	"fmt"
)

var ErrProjectNotFound = errors.New("project not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(project *Project) error {
	_, err := r.db.Exec(`
		INSERT INTO projects (
			id,
			owner_id,
			name,
			main_file,
			engine,
			bibliography
		)
		VALUES (?, ?, ?, ?, ?, ?)
	`,
		project.ID,
		project.OwnerID,
		project.Name,
		project.MainFile,
		project.Engine,
		project.Bibliography,
	)

	if err != nil {
		return fmt.Errorf("create project: %w", err)
	}

	return nil
}

func (r *Repository) ListByOwnerOrMember(userId string) ([]*Project, error) {
	rows, err := r.db.Query(`
		SELECT
			id,
			owner_id,
			name,
			main_file,
			engine,
			bibliography,
			created_at,
			updated_at
		FROM projects p
		LEFT JOIN project_memberships pm ON p.id = pm.project_id
		WHERE p.owner_id = ?
		OR pm.member_id = ?
		ORDER BY updated_at DESC
	`, userId, userId)

	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var projects []*Project

	for rows.Next() {
		project := &Project{}

		if err := rows.Scan(
			&project.ID,
			&project.OwnerID,
			&project.Name,
			&project.MainFile,
			&project.Engine,
			&project.Bibliography,
			&project.CreatedAt,
			&project.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}

		projects = append(projects, project)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate projects: %w", err)
	}

	return projects, nil
}

func (r *Repository) GetByID(id string) (*Project, error) {
	project := &Project{}

	err := r.db.QueryRow(`
		SELECT
			id,
			owner_id,
			name,
			main_file,
			engine,
			bibliography,
			created_at,
			updated_at
		FROM projects
		WHERE id = ?
	`, id).Scan(
		&project.ID,
		&project.OwnerID,
		&project.Name,
		&project.MainFile,
		&project.Engine,
		&project.Bibliography,
		&project.CreatedAt,
		&project.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrProjectNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}

	return project, nil
}