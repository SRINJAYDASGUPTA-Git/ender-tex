package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var ErrUserNotFound = errors.New("user not found")
var ErrSessionNotFound = errors.New("session not found")
var ErrInvitationNotFound = errors.New("invitation not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(user *User) error {
	_, err := r.db.Exec(`
		INSERT INTO users (
			id,
			email,
			name,
			password_hash,
			role
		)
		VALUES (?, ?, ?, ?, ?)
	`,
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
		user.Role,
	)

	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}

	return nil
}

func (r *Repository) GetUserByEmail(email string) (*User, error) {
	user := &User{}

	err := r.db.QueryRow(`
		SELECT
			id,
			email,
			name,
			password_hash,
			role,
			created_at,
			updated_at
		FROM users
		WHERE email = ?
	`, email).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}

	if err := r.loadProjectIDs(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) GetUserByID(id string) (*User, error) {
	user := &User{}

	err := r.db.QueryRow(`
		SELECT
			id,
			email,
			name,
			password_hash,
			role,
			created_at,
			updated_at
		FROM users
		WHERE id = ?
	`, id).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}

	if err := r.loadProjectIDs(user); err != nil {
		return nil, err
	}

	return user, nil
}
func (r *Repository) loadProjectIDs(user *User) error {
	rows, err := r.db.Query(`
		SELECT project_id
		FROM project_memberships
		WHERE user_id = ?
		ORDER BY project_id
	`, user.ID)
	if err != nil {
		return fmt.Errorf("get user projects: %w", err)
	}
	defer rows.Close()

	user.ProjectIDs = []string{}

	for rows.Next() {
		var projectID string

		if err := rows.Scan(&projectID); err != nil {
			return fmt.Errorf("scan project id: %w", err)
		}

		user.ProjectIDs = append(user.ProjectIDs, projectID)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate project ids: %w", err)
	}

	return nil
}
func (r *Repository) GetSessionByTokenHash(tokenHash string) (*Session, error) {
	session := &Session{}

	err := r.db.QueryRow(`
		SELECT
			id,
			user_id,
			token_hash,
			expires_at,
			created_at
		FROM sessions
		WHERE token_hash = ?
	`, tokenHash).Scan(
		&session.ID,
		&session.UserID,
		&session.TokenHash,
		&session.ExpiresAt,
		&session.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSessionNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	return session, nil
}

func (r *Repository) DeleteSession(tokenHash string) error {
	_, err := r.db.Exec(`
		DELETE FROM sessions
		WHERE token_hash = ?
	`, tokenHash)

	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}

	return nil
}

func (r *Repository) CreateInvitation(invitation *Invitation, tokenHash string) error {
	_, err := r.db.Exec(`
		INSERT INTO invitations (
			id,
			email,
			name,
			role,
			project_id,
			existing_user,
			token_hash,
			expires_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`,
		invitation.ID,
		invitation.Email,
		invitation.Name,
		invitation.Role,
		invitation.ProjectID,
		invitation.ExistingUser,
		tokenHash,
		invitation.ExpiresAt,
	)

	if err != nil {
		return fmt.Errorf("create invitation: %w", err)
	}

	return nil
}

func (r *Repository) GetInvitationByTokenHash(tokenHash string) (*Invitation, error) {
	invitation := &Invitation{}

	err := r.db.QueryRow(`
		SELECT
			id,
			email,
			name,
			role,
			project_id,
			existing_user,
			expires_at,
			created_at
		FROM invitations
		WHERE token_hash = ?
	`, tokenHash).Scan(
		&invitation.ID,
		&invitation.Email,
		&invitation.Name,
		&invitation.Role,
		&invitation.ProjectID,
		&invitation.ExistingUser,
		&invitation.ExpiresAt,
		&invitation.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInvitationNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}

	return invitation, nil
}

func (r *Repository) DeleteInvitation(id string) error {
	_, err := r.db.Exec(`
		DELETE FROM invitations
		WHERE id = ?
	`, id)

	if err != nil {
		return fmt.Errorf("delete invitation: %w", err)
	}

	return nil
}

func (r *Repository) AcceptInvitation(
	invitation *Invitation,
	passwordHash string,
) (*User, *Session, string, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, nil, "", fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()
	var user *User
	if invitation.ExistingUser {
		user, err = r.GetUserByEmail(invitation.Email)
		if err != nil {
			return nil, nil, "", fmt.Errorf("get user by email: %w", err)
		}
		if user == nil {
			return nil, nil, "", fmt.Errorf("user not found")
		}
	} else {
		user = &User{
			ID:           uuid.NewString(),
			Email:        invitation.Email,
			Name:         invitation.Name,
			PasswordHash: passwordHash,
			Role:         invitation.Role,
		}
		_, err = tx.Exec(`
			INSERT INTO users (
				id,
				email,
				name,
				password_hash,
				role
			)
			VALUES (?, ?, ?, ?, ?)
		`,
			user.ID,
			user.Email,
			user.Name,
			user.PasswordHash,
			user.Role,
		)
		if err != nil {
			return nil, nil, "", fmt.Errorf("create invited user: %w", err)
		}
	}
	_, err = tx.Exec(`
		INSERT OR IGNORE INTO project_memberships (user_id, project_id)
		VALUES (?, ?)
	`,
		user.ID,
		invitation.ProjectID,
	)
	if err != nil {
		return nil, nil, "", fmt.Errorf("create project membership: %w", err)
	}
	
	result, err := tx.Exec(`
		DELETE FROM invitations
		WHERE id = ?
	`,
		invitation.ID,
	)

	if err != nil {
		return nil, nil, "", fmt.Errorf("consume invitation: %w", err)
	}

	sessionID := uuid.NewString()
	
	sessionToken, err := generateToken()
	if err != nil {
		return nil, nil, "", fmt.Errorf("generate session token: %w", err)
	}
	
	session := &Session{
		ID:        sessionID,
		UserID:    user.ID,
		TokenHash: hashToken(sessionToken),
		ExpiresAt: time.Now().Add(sessionDuration),
	}
	_, err = tx.Exec(`
		INSERT INTO sessions (
			id,
			user_id,
			token_hash,
			expires_at
		)
		VALUES (?, ?, ?, ?)
	`,
		session.ID,
		session.UserID,
		session.TokenHash,
		session.ExpiresAt,
	)
	if err != nil {
		return nil, nil, "", fmt.Errorf("create session: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, nil, "", fmt.Errorf("check invitation consumption: %w", err)
	}

	if rows != 1 {
		return nil, nil, "", ErrInvitationNotFound
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, "", fmt.Errorf("commit invitation acceptance: %w", err)
	}

	return user, session, sessionToken, nil
}