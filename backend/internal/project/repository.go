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
		SELECT DISTINCT
			p.id,
			p.owner_id,
			p.name,
			p.main_file,
			p.engine,
			p.bibliography,
			p.created_at,
			p.updated_at
		FROM projects p
		LEFT JOIN project_memberships pm ON p.id = pm.project_id
		WHERE p.owner_id = ?
		OR pm.user_id = ?
		ORDER BY p.updated_at DESC
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

func (r *Repository) IsMember(projectID, userID string) (bool, error) {
	var exists bool

	err := r.db.QueryRow(`
		SELECT EXISTS (
    SELECT 1
    FROM project_memberships
    WHERE project_id = ?
      AND user_id = ?
		)
	`, projectID, userID).Scan(&exists)

	if err != nil {
		return false, fmt.Errorf("check membership: %w", err)
	}

	return exists, nil
}

func (r *Repository) Exists(projectID string) (bool, error) {
	var exists bool

	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM projects
			WHERE id = ?
		)
	`, projectID).Scan(&exists)

	if err != nil {
		return false, fmt.Errorf("check project existence: %w", err)
	}

	return exists, nil
}
func (r *Repository) GetName(projectID string) (string, error) {
	var name string

	err := r.db.QueryRow(`
		SELECT name
		FROM projects
		WHERE id = ?
	`, projectID).Scan(&name)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errors.New("project not found")
		}

		return "", fmt.Errorf("get project name: %w", err)
	}

	return name, nil
}