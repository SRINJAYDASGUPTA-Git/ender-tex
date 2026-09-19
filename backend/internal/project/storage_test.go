package project

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestStorage_SafeFilePath(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to init storage: %v", err)
	}

	tests := []struct {
		name      string
		filePath  string
		wantError error
	}{
		{"valid file", "main.tex", nil},
		{"valid nested file", "chapters/intro.tex", nil},
		{"empty path", "", ErrInvalidPath},
		{"absolute path", "/etc/passwd", ErrInvalidPath},
		{"directory traversal basic", "../main.tex", ErrInvalidPath},
		{"directory traversal nested", "chapters/../../main.tex", ErrInvalidPath},
		{"current dir", ".", ErrInvalidPath},
		{"parent dir", "..", ErrInvalidPath},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := storage.safeFilePath("proj-1", tt.filePath)
			if !errors.Is(err, tt.wantError) {
				t.Errorf("expected error %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestStorage_ProjectLifecycle(t *testing.T) {
	tempDir := t.TempDir()
	storage, _ := NewStorage(tempDir)
	projectID := "lifecycle-proj"

	// 1. Create Project
	err := storage.CreateProject(projectID, "main.tex")
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}

	// 2. Read initialized file
	content, err := storage.ReadFile(projectID, "main.tex")
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	if !bytes.Contains(content, []byte("\\documentclass{article}")) {
		t.Errorf("unexpected content: %s", string(content))
	}

	// 3. Write new file
	err = storage.WriteFile(projectID, "refs.bib", []byte("bib data"))
	if err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	// 4. List files
	files, err := storage.ListFiles(projectID)
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}
	if len(files) != 2 {
		t.Errorf("expected 2 files, got %d", len(files))
	}

	// 5. Copy Project
	destDir := filepath.Join(t.TempDir(), "export")
	err = storage.CopyProjectTo(projectID, destDir)
	if err != nil {
		t.Fatalf("CopyProjectTo failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(destDir, "main.tex")); os.IsNotExist(err) {
		t.Error("expected main.tex to be copied")
	}

	// 6. Delete project
	err = storage.DeleteProject(projectID)
	if err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}

	// Verify deletion
	_, err = storage.ReadFile(projectID, "main.tex")
	if !errors.Is(err, ErrFileNotFound) {
		t.Errorf("expected ErrFileNotFound after deletion, got %v", err)
	}
}

func TestStorage_FileAndDirectoryOperations(t *testing.T) {
	tempDir := t.TempDir()
	storage, _ := NewStorage(tempDir)
	projectID := "ops-proj"

	_ = storage.CreateProject(projectID, "main.tex")

	t.Run("Create and Delete File", func(t *testing.T) {
		err := storage.CreateFile(projectID, "new.tex")
		if err != nil {
			t.Fatalf("CreateFile failed: %v", err)
		}

		err = storage.CreateFile(projectID, "new.tex")
		if err == nil {
			t.Fatal("expected error creating existing file")
		}

		err = storage.DeleteFile(projectID, "new.tex")
		if err != nil {
			t.Fatalf("DeleteFile failed: %v", err)
		}
	})

	t.Run("Rename File", func(t *testing.T) {
		_ = storage.CreateFile(projectID, "old.tex")
		err := storage.RenameFile(projectID, "old.tex", "renamed.tex")
		if err != nil {
			t.Fatalf("RenameFile failed: %v", err)
		}
	})

	t.Run("Create and Delete Directory", func(t *testing.T) {
		err := storage.CreateDirectory(projectID, "images")
		if err != nil {
			t.Fatalf("CreateDirectory failed: %v", err)
		}

		err = storage.RenameDirectory(projectID, "images", "assets")
		if err != nil {
			t.Fatalf("RenameDirectory failed: %v", err)
		}

		// Prevent deleting non-empty directory
		_ = storage.CreateFile(projectID, "assets/logo.png")
		err = storage.DeleteDirectory(projectID, "assets")
		if !errors.Is(err, ErrDirectoryNotEmpty) {
			t.Fatalf("expected ErrDirectoryNotEmpty, got %v", err)
		}

		_ = storage.DeleteFile(projectID, "assets/logo.png")
		err = storage.DeleteDirectory(projectID, "assets")
		if err != nil {
			t.Fatalf("DeleteDirectory failed: %v", err)
		}
	})
}
