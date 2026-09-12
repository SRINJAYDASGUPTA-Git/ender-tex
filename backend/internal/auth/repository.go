package auth

import (
	"database/sql"
	"errors"
	"fmt"
)

var ErrUserNotFound = errors.New("user not found")
var ErrSessionNotFound = errors.New("session not found")

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
			password_hash,
			role
		)
		VALUES (?, ?, ?, ?)
	`,
		user.ID,
		user.Email,
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
			password_hash,
			role,
			created_at,
			updated_at
		FROM users
		WHERE email = ?
	`, email).Scan(
		&user.ID,
		&user.Email,
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

	return user, nil
}

func (r *Repository) GetUserByID(id string) (*User, error) {
	user := &User{}

	err := r.db.QueryRow(`
		SELECT
			id,
			email,
			password_hash,
			role,
			created_at,
			updated_at
		FROM users
		WHERE id = ?
	`, id).Scan(
		&user.ID,
		&user.Email,
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

	return user, nil
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
