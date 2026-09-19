package project

import (
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}

	_, err = db.Exec(`
		PRAGMA foreign_keys = ON;
		CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, password_hash TEXT, role TEXT);
		CREATE TABLE projects (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), name TEXT, main_file TEXT, engine TEXT, bibliography TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
		CREATE TABLE project_memberships (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), permission TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
		CREATE TABLE invitations (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, email TEXT, name TEXT, role TEXT, token_hash TEXT, expires_at DATETIME, existing_user INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}

	// Seed a user to satisfy foreign keys
	_, _ = db.Exec(`INSERT INTO users (id, email, name, password_hash, role) VALUES ('user-1', 'test@test.com', 'Test', 'hash', 'COLLABORATOR')`)
	return db
}

func TestRepository_CreateAndGetProject(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewRepository(db)

	p := &Project{
		ID:           "proj-1",
		OwnerID:      "user-1",
		Name:         "Thesis",
		MainFile:     "main.tex",
		Engine:       EnginePDFLaTeX,
		Bibliography: BibliographyBiber,
	}

	err := repo.Create(p)
	if err != nil {
		t.Fatalf("Create() error: %v", err)
	}

	fetched, err := repo.GetByID("proj-1")
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}
	if fetched.Name != "Thesis" {
		t.Errorf("expected name 'Thesis', got %q", fetched.Name)
	}

	// Check Owner is automatically a member
	isMember, err := repo.IsMember("proj-1", "user-1")
	if err != nil || !isMember {
		t.Errorf("owner should automatically be a member")
	}

	// Check name retrieval
	name, err := repo.GetName("proj-1")
	if err != nil || name != "Thesis" {
		t.Errorf("GetName() failed: %v, %v", name, err)
	}
}

func TestRepository_ListByOwnerOrMember(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewRepository(db)

	_, _ = db.Exec(`INSERT INTO users (id) VALUES ('user-2')`)

	p1 := &Project{ID: "p1", OwnerID: "user-1", Name: "P1", MainFile: "m.tex", Engine: "pdflatex", Bibliography: "biber"}
	p2 := &Project{ID: "p2", OwnerID: "user-2", Name: "P2", MainFile: "m.tex", Engine: "pdflatex", Bibliography: "biber"}

	_ = repo.Create(p1)
	_ = repo.Create(p2)

	// Make user-1 a viewer on user-2's project
	_, _ = db.Exec(`INSERT INTO project_memberships (id, project_id, user_id, permission) VALUES ('m1', 'p2', 'user-1', 'VIEWER')`)

	projects, err := repo.ListByOwnerOrMember("user-1")
	if err != nil {
		t.Fatalf("ListByOwnerOrMember() error: %v", err)
	}

	if len(projects) != 2 {
		t.Errorf("expected 2 projects, got %d", len(projects))
	}
}

func TestRepository_UpdateAndDelete(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewRepository(db)

	p := &Project{ID: "p1", OwnerID: "user-1", Name: "P1", MainFile: "m.tex", Engine: "pdflatex", Bibliography: "biber"}
	_ = repo.Create(p)

	err := repo.UpdateProjectName("p1", "Updated Name")
	if err != nil {
		t.Fatalf("UpdateProjectName() error: %v", err)
	}

	name, _ := repo.GetName("p1")
	if name != "Updated Name" {
		t.Errorf("expected 'Updated Name', got %q", name)
	}

	err = repo.DeleteProject("p1")
	if err != nil {
		t.Fatalf("DeleteProject() error: %v", err)
	}

	exists, _ := repo.Exists("p1")
	if exists {
		t.Error("project should not exist after deletion")
	}
}

func TestRepository_MembersAndInvitations(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewRepository(db)

	_, _ = db.Exec(`INSERT INTO users (id, name, email) VALUES ('user-2', 'Two', 'two@test.com')`)
	p := &Project{ID: "p1", OwnerID: "user-1", Name: "P1", MainFile: "m.tex", Engine: "pdflatex", Bibliography: "biber"}
	_ = repo.Create(p)

	// Members
	_, _ = db.Exec(`INSERT INTO project_memberships (id, project_id, user_id, permission) VALUES ('m2', 'p1', 'user-2', 'VIEWER')`)

	err := repo.UpdateMemberPermission("p1", "user-2", PermissionEditor)
	if err != nil {
		t.Fatalf("UpdateMemberPermission() error: %v", err)
	}

	perm, err := repo.GetMemberPermission("p1", "user-2")
	if err != nil || perm != PermissionEditor {
		t.Errorf("expected EDITOR, got %v", perm)
	}

	members, err := repo.ListMembers("p1")
	if err != nil || len(members) != 2 {
		t.Errorf("expected 2 members, got %d", len(members))
	}

	err = repo.RemoveMember("p1", "user-2")
	if err != nil {
		t.Fatalf("RemoveMember() error: %v", err)
	}

	// Invitations: Use SQLite's native datetime function to ensure exact string matching
	_, err = db.Exec(`
		INSERT INTO invitations (id, project_id, email, name, role, token_hash, expires_at, existing_user) 
		VALUES ('i1', 'p1', 'inv@test.com', 'Invitee', 'COLLABORATOR', 'hash', datetime('now', '+1 hour'), 0)
	`)
	if err != nil {
		t.Fatalf("Failed to seed invitation: %v", err)
	}

	invites, err := repo.ListInvitationsByProject("p1")
	if err != nil || len(invites) != 1 {
		t.Errorf("expected 1 invitation, got %d (err: %v)", len(invites), err)
	}
}

func TestRepository_EdgeCases(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := NewRepository(db)

	t.Run("Get non-existent project", func(t *testing.T) {
		_, err := repo.GetByID("ghost")
		if !errors.Is(err, ErrProjectNotFound) {
			t.Errorf("expected ErrProjectNotFound, got %v", err)
		}
	})

	t.Run("Update non-existent project", func(t *testing.T) {
		err := repo.UpdateProjectName("ghost", "Name")
		if !errors.Is(err, ErrProjectNotFound) {
			t.Errorf("expected ErrProjectNotFound, got %v", err)
		}
	})

	t.Run("Get permission for non-member", func(t *testing.T) {
		_, err := repo.GetMemberPermission("ghost", "user")
		if err == nil {
			t.Errorf("expected error for non-existent member")
		}
	})
}
