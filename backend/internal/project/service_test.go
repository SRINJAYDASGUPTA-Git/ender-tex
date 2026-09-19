package project

import (
	"errors"
	"strings"
	"testing"
)

func setupTestService(t *testing.T) (*Service, string) {
	db := setupTestDB(t) // Reuses the DB setup from repository_test.go
	repo := NewRepository(db)
	tempDir := t.TempDir()
	storage, err := NewStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	return NewService(repo, storage), tempDir
}

func TestService_ProjectLifecycle(t *testing.T) {
	svc, _ := setupTestService(t)

	// 1. Create Project
	req := CreateProjectRequest{Name: "My Awesome Paper"}
	p, err := svc.Create("user-1", req)
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}

	// 2. List Projects
	list, err := svc.List("user-1")
	if err != nil || len(list) == 0 {
		t.Fatalf("List() failed: %v", err)
	}

	// 3. GetForUser
	fetched, err := svc.GetForUser(p.ID, "user-1")
	if err != nil || fetched.Name != "My Awesome Paper" {
		t.Fatalf("GetForUser() failed: %v", err)
	}

	// 4. Rename Project
	renamed, err := svc.RenameProject(p.ID, "user-1", "Renamed Paper")
	if err != nil || renamed.Name != "Renamed Paper" {
		t.Fatalf("RenameProject() failed: %v", err)
	}

	// 5. CanEdit
	canEdit, err := svc.CanEdit(p.ID, "user-1")
	if err != nil || !canEdit {
		t.Fatalf("CanEdit() failed for owner: %v", err)
	}

	// 6. Delete Project
	err = svc.DeleteProject(p.ID, "user-1")
	if err != nil {
		t.Fatalf("DeleteProject() failed: %v", err)
	}

	// Verify Deletion
	_, err = svc.Get(p.ID)
	if !errors.Is(err, ErrProjectNotFound) {
		t.Fatalf("Expected project to be deleted, got %v", err)
	}
}

func TestService_AccessControl(t *testing.T) {
	svc, _ := setupTestService(t)

	_, _ = svc.repository.db.Exec(`INSERT INTO users (id, email, name, password_hash, role) VALUES ('user-2', 'two@test.com', 'Two', 'hash', 'COLLABORATOR')`)

	p, err := svc.Create("user-1", CreateProjectRequest{Name: "P1"})
	if err != nil {
		t.Fatalf("failed to create test project: %v", err)
	}

	_, err = svc.GetForUser(p.ID, "user-2")
	if !errors.Is(err, ErrProjectAccessDenied) {
		t.Fatalf("expected access denied, got %v", err)
	}

	_, err = svc.RenameProject(p.ID, "user-2", "Hack")
	if !errors.Is(err, ErrProjectForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	err = svc.DeleteProject(p.ID, "user-2")
	if !errors.Is(err, ErrProjectForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	_, _ = svc.repository.db.Exec(`INSERT INTO project_memberships (id, project_id, user_id, permission) VALUES ('m2', ?, 'user-2', 'VIEWER')`, p.ID)

	canEdit, _ := svc.CanEdit(p.ID, "user-2")
	if canEdit {
		t.Fatalf("viewer should not be able to edit")
	}

	fetched, err := svc.GetForUser(p.ID, "user-2")
	if err != nil || fetched.ID != p.ID {
		t.Fatalf("viewer should be able to read project")
	}

	err = svc.UpdateMember(p.ID, "user-2", PermissionEditor)
	if err != nil {
		t.Fatalf("UpdateMember failed: %v", err)
	}

	canEdit, _ = svc.CanEdit(p.ID, "user-2")
	if !canEdit {
		t.Fatalf("editor should be able to edit")
	}

	err = svc.UpdateMember(p.ID, "user-2", "INVALID")
	if err == nil {
		t.Fatalf("expected error for invalid permission")
	}

	err = svc.RemoveMember(p.ID, "user-2")
	if err != nil {
		t.Fatalf("RemoveMember failed: %v", err)
	}
}

func TestService_Validations(t *testing.T) {
	svc, _ := setupTestService(t)

	tests := []struct {
		req CreateProjectRequest
		err string
	}{
		{CreateProjectRequest{Name: ""}, "project name is required"},
		{CreateProjectRequest{Name: strings.Repeat("A", 201)}, "project name is too long"},
		{CreateProjectRequest{Name: "P", Engine: "invalid"}, "invalid LaTeX engine"},
		{CreateProjectRequest{Name: "P", Bibliography: "invalid"}, "invalid bibliography backend"},
		{CreateProjectRequest{Name: "P", MainFile: "/abs.tex"}, "main file must be relative"},
		{CreateProjectRequest{Name: "P", MainFile: "bad\\path.tex"}, "main file contains invalid path separators"},
		{CreateProjectRequest{Name: "P", MainFile: "../out.tex"}, "main file contains invalid path traversal"},
		{CreateProjectRequest{Name: "P", MainFile: "main.txt"}, "main file must have a .tex extension"},
	}

	for _, tt := range tests {
		t.Run(tt.err, func(t *testing.T) {
			_, err := svc.Create("user-1", tt.req)
			if err == nil || !strings.Contains(err.Error(), tt.err) {
				t.Errorf("expected error %q, got %v", tt.err, err)
			}
		})
	}

	// Create a valid project so we can test the RenameProject validations!
	validProject, err := svc.Create("user-1", CreateProjectRequest{Name: "Valid Project"})
	if err != nil {
		t.Fatalf("failed to create valid project: %v", err)
	}

	// Test Rename limits
	_, err = svc.RenameProject(validProject.ID, "user-1", "")
	if err == nil || err.Error() != "project name cannot be empty" {
		t.Errorf("expected empty name error, got %v", err)
	}

	_, err = svc.RenameProject(validProject.ID, "user-1", strings.Repeat("A", 201))
	if err == nil || err.Error() != "project name is too long" {
		t.Errorf("expected long name error, got %v", err)
	}
}

func TestService_OwnerChecks(t *testing.T) {
	svc, _ := setupTestService(t)
	_, _ = svc.repository.db.Exec(`INSERT INTO users (id, email, name, password_hash, role) VALUES ('user-2', 'two@test.com', 'Two', 'hash', 'COLLABORATOR')`)
	p, _ := svc.Create("user-1", CreateProjectRequest{Name: "P1"})

	// GetForOwner success
	_, err := svc.GetForOwner(p.ID, "user-1")
	if err != nil {
		t.Fatalf("GetForOwner failed: %v", err)
	}

	// GetForOwner failure
	_, err = svc.GetForOwner(p.ID, "user-2")
	if !errors.Is(err, ErrProjectAccessDenied) {
		t.Fatalf("expected ErrProjectAccessDenied")
	}
}
