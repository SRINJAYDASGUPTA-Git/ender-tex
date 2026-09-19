package auth

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}

	t.Cleanup(func() {
		_ = db.Close()
	})

	_, err = db.Exec(`
		PRAGMA foreign_keys = ON;

		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'COLLABORATOR',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			name TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (user_id)
				REFERENCES users(id)
				ON DELETE CASCADE
		);

		CREATE INDEX idx_sessions_token_hash
			ON sessions(token_hash);

		CREATE INDEX idx_sessions_user_id
			ON sessions(user_id);

		CREATE INDEX idx_sessions_expires_at
			ON sessions(expires_at);

		CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			owner_id TEXT NOT NULL,
			name TEXT NOT NULL,
			main_file TEXT NOT NULL DEFAULT 'main.tex',
			engine TEXT NOT NULL DEFAULT 'pdflatex',
			bibliography TEXT NOT NULL DEFAULT 'biber',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (owner_id)
				REFERENCES users(id)
				ON DELETE CASCADE,

			CHECK (engine IN (
				'pdflatex',
				'latex',
				'xelatex',
				'lualatex'
			)),

			CHECK (bibliography IN (
				'biber',
				'bibtex'
			))
		);

		CREATE INDEX idx_projects_owner_id
			ON projects(owner_id);

		CREATE INDEX idx_projects_updated_at
			ON projects(updated_at);

		CREATE TABLE project_memberships (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			permission TEXT NOT NULL DEFAULT 'EDITOR',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (project_id)
				REFERENCES projects(id)
				ON DELETE CASCADE,

			FOREIGN KEY (user_id)
				REFERENCES users(id)
				ON DELETE CASCADE,

			UNIQUE(project_id, user_id),

			CHECK (permission IN (
				'VIEWER',
				'EDITOR'
			))
		);

		CREATE INDEX idx_project_memberships_project_id
			ON project_memberships(project_id);

		CREATE INDEX idx_project_memberships_user_id
			ON project_memberships(user_id);

		CREATE TABLE invitations (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'COLLABORATOR',
			token_hash TEXT NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			project_id TEXT REFERENCES projects(id),
			name TEXT NOT NULL DEFAULT '',
			existing_user INTEGER NOT NULL DEFAULT 0
		);

		CREATE INDEX idx_invitations_token_hash
			ON invitations(token_hash);

		CREATE INDEX idx_invitations_email
			ON invitations(email);

		CREATE INDEX idx_invitations_expires_at
			ON invitations(expires_at);

		CREATE INDEX idx_invitations_project_id
			ON invitations(project_id);
	`)

	if err != nil {
		_ = db.Close()
		t.Fatalf("create test schema: %v", err)
	}

	return db
}
