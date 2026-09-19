package project

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
	"uuid"
)

var ErrProjectNotFound = errors.New("project not found")

type Role string
type Invitation struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Role         Role      `json:"role"`
	ProjectID    string    `json:"project_id"`
	ExistingUser bool      `json:"existing_user"`
	ExpiresAt    time.Time `json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(project *Project) error {

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
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
	membershipID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO project_memberships (
			id,
			user_id,
			project_id,
			permission
		)
		VALUES (?, ?, ?, ?)
	`,
		membershipID,
		project.OwnerID,
		project.ID,
		"EDITOR",
	)

	if err != nil {
		return fmt.Errorf("create project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit project: %w", err)
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

func (r *Repository) UpdateProjectName(id string, name string) error {
	result, err := r.db.Exec(`
        UPDATE projects
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, name, id)

	if err != nil {
		return fmt.Errorf("update project name: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check project update: %w", err)
	}

	if rows == 0 {
		return ErrProjectNotFound
	}

	return nil
}

func (r *Repository) DeleteProject(id string) error {
	result, err := r.db.Exec(`
        DELETE FROM projects
        WHERE id = ?
    `, id)

	if err != nil {
		return fmt.Errorf("delete project: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check project deletion: %w", err)
	}

	if rows == 0 {
		return ErrProjectNotFound
	}

	return nil
}

func (r *Repository) ListMembers(projectID string) ([]*ProjectMembership, error) {
	rows, err := r.db.Query(`
		SELECT
			pm.id,
			pm.project_id,
			pm.user_id,
			pm.permission,
			pm.created_at,
			user.name,
			user.email
		FROM project_memberships pm
		JOIN users user ON pm.user_id = user.id
		WHERE pm.project_id = ?
		ORDER BY pm.created_at ASC
	`, projectID)

	if err != nil {
		return nil, fmt.Errorf("list project members: %w", err)
	}
	defer rows.Close()

	var members []*ProjectMembership

	for rows.Next() {
		member := &ProjectMembership{}

		if err := rows.Scan(
			&member.ID,
			&member.ProjectID,
			&member.UserID,
			&member.Permission,
			&member.CreatedAt,
			&member.Name,
			&member.Email,
		); err != nil {
			return nil, fmt.Errorf("scan project member: %w", err)
		}

		members = append(members, member)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate project members: %w", err)
	}

	return members, nil
}

func (r *Repository) UpdateMemberPermission(
	projectID string,
	userID string,
	permission string,
) error {
	result, err := r.db.Exec(`
		UPDATE project_memberships
		SET permission = ?
		WHERE project_id = ?
		  AND user_id = ?
	`, permission, projectID, userID)

	if err != nil {
		return fmt.Errorf("update member permission: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check member update: %w", err)
	}

	if rows == 0 {
		return errors.New("project member not found")
	}

	return nil
}

func (r *Repository) RemoveMember(
	projectID string,
	userID string,
) error {
	result, err := r.db.Exec(`
		DELETE FROM project_memberships
		WHERE project_id = ?
		  AND user_id = ?
	`, projectID, userID)

	if err != nil {
		return fmt.Errorf("remove project member: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check member removal: %w", err)
	}

	if rows == 0 {
		return errors.New("project member not found")
	}

	return nil
}

func (r *Repository) ListInvitationsByProject(
	projectID string,
) ([]*Invitation, error) {
	rows, err := r.db.Query(`
		SELECT
			id,
			name,
			email,
			role,
			project_id,
			existing_user,
			expires_at,
			created_at
		FROM invitations
		WHERE project_id = ?
		  AND expires_at > CURRENT_TIMESTAMP
		ORDER BY created_at DESC
	`, projectID)

	if err != nil {
		return nil, fmt.Errorf("list project invitations: %w", err)
	}
	defer rows.Close()

	var invitations []*Invitation

	for rows.Next() {
		invitation := &Invitation{}

		var existingUser int

		if err := rows.Scan(
			&invitation.ID,
			&invitation.Name,
			&invitation.Email,
			&invitation.Role,
			&invitation.ProjectID,
			&existingUser,
			&invitation.ExpiresAt,
			&invitation.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan invitation: %w", err)
		}

		invitation.ExistingUser = existingUser != 0

		invitations = append(invitations, invitation)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate project invitations: %w", err)
	}

	return invitations, nil
}

func (r *Repository) GetMemberPermission(
	projectID string,
	userID string,
) (string, error) {
	var permission string

	err := r.db.QueryRow(`
		SELECT permission
		FROM project_memberships
		WHERE project_id = ?
		  AND user_id = ?
	`, projectID, userID).Scan(&permission)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrProjectAccessDenied
		}

		return "", fmt.Errorf(
			"get member permission: %w",
			err,
		)
	}

	return permission, nil
}
