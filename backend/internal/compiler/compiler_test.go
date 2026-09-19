package compiler

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// setupMockDocker creates a fake 'docker' executable in a temporary directory
// and prepends it to the system PATH so exec.CommandContext finds it first.
func setupMockDocker(t *testing.T, exitCode int, mockOutput string) {
	t.Helper()
	tmpDir := t.TempDir()
	mockPath := filepath.Join(tmpDir, "docker")

	// Create a simple shell script to act as our docker binary
	script := "#!/bin/sh\n" +
		"echo '" + mockOutput + "'\n" +
		"exit " + string(rune('0'+exitCode)) + "\n"

	err := os.WriteFile(mockPath, []byte(script), 0755)
	if err != nil {
		t.Fatalf("failed to write mock docker script: %v", err)
	}

	oldPath := os.Getenv("PATH")
	t.Setenv("PATH", tmpDir+string(os.PathListSeparator)+oldPath)
}

func TestPdfName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"main.tex", "main.pdf"},
		{"paper.tex", "paper.pdf"},
		{"short", "short.pdf"},
		{"no_extension_file", "no_extension_file.pdf"},
	}
	for _, tt := range tests {
		if got := pdfName(tt.input); got != tt.expected {
			t.Errorf("pdfName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestCompiler_Validations(t *testing.T) {
	ctx := context.Background()

	t.Run("missing image config", func(t *testing.T) {
		c := New(Config{Image: ""})
		_, err := c.Compile(ctx, "dir", "pdflatex", "main.tex")
		if err == nil || !strings.Contains(err.Error(), "image is not configured") {
			t.Errorf("expected missing image error, got %v", err)
		}
	})

	t.Run("missing main file param", func(t *testing.T) {
		c := New(Config{Image: "texlive"})
		_, err := c.Compile(ctx, "dir", "pdflatex", "")
		if err == nil || !strings.Contains(err.Error(), "main file is not configured") {
			t.Errorf("expected missing main file error, got %v", err)
		}
	})

	t.Run("main file does not exist on disk", func(t *testing.T) {
		c := New(Config{Image: "texlive"})
		buildDir := t.TempDir()
		_, err := c.Compile(ctx, buildDir, "pdflatex", "missing.tex")
		if err == nil || !strings.Contains(err.Error(), "main file not found") {
			t.Errorf("expected file not found error, got %v", err)
		}
	})
}

func TestCompiler_Engines(t *testing.T) {
	ctx := context.Background()

	// Mock docker to exit successfully (0)
	setupMockDocker(t, 0, "mock successful build output")

	c := New(Config{Image: "texlive"})

	// Test all supported engines mapped in docker.go
	engines := []string{"pdflatex", "xelatex", "lualatex", "latex"}

	for _, engine := range engines {
		t.Run(engine, func(t *testing.T) {
			buildDir := t.TempDir()
			mainFile := "main.tex"
			_ = os.WriteFile(filepath.Join(buildDir, mainFile), []byte("fake tex content"), 0644)

			// Pre-create the PDF to simulate the compiler actually doing its job
			_ = os.WriteFile(filepath.Join(buildDir, "main.pdf"), []byte("fake pdf content"), 0644)

			res, err := c.Compile(ctx, buildDir, engine, mainFile)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Success {
				t.Error("expected success to be true")
			}
			if !res.PDFAvailable {
				t.Error("expected PDF to be available")
			}
			if !strings.Contains(res.Log, "mock successful build output") {
				t.Errorf("expected log to contain stdout from mock, got %q", res.Log)
			}
		})
	}

	t.Run("unsupported engine", func(t *testing.T) {
		buildDir := t.TempDir()
		mainFile := "main.tex"
		_ = os.WriteFile(filepath.Join(buildDir, mainFile), []byte("fake tex content"), 0644)

		_, err := c.Compile(ctx, buildDir, "invalid-engine", mainFile)
		if err == nil || !strings.Contains(err.Error(), "unsupported LaTeX engine") {
			t.Errorf("expected unsupported engine error, got %v", err)
		}
	})
}

func TestCompiler_FailureAndLog(t *testing.T) {
	ctx := context.Background()

	// Mock docker to fail (exit status 1)
	setupMockDocker(t, 1, "Fatal error occurred, no output PDF file produced!")

	c := New(Config{Image: "texlive"})
	buildDir := t.TempDir()
	mainFile := "main.tex"
	_ = os.WriteFile(filepath.Join(buildDir, mainFile), []byte("fake tex content"), 0644)

	res, err := c.Compile(ctx, buildDir, "pdflatex", mainFile)
	if err != nil {
		t.Fatalf("did not expect error from Compile itself, got %v", err)
	}
	if res.Success {
		t.Error("expected success to be false on docker failure")
	}
	if res.PDFAvailable {
		t.Error("did not expect PDF to be available since it wasn't created")
	}
	if !strings.Contains(res.Log, "Fatal error occurred") {
		t.Errorf("expected error log, got %q", res.Log)
	}
}

func TestService_Compile(t *testing.T) {
	ctx := context.Background()

	t.Run("Compiler returns error", func(t *testing.T) {
		c := New(Config{Image: ""}) // Missing image configuration triggers validation error
		svc := NewService(c)
		_, err := svc.Compile(ctx, "dir", "pdflatex", "main.tex")
		if err == nil {
			t.Error("expected error from underlying compiler")
		}
	})

	t.Run("Compilation fails (success=false)", func(t *testing.T) {
		setupMockDocker(t, 1, "failed")
		c := New(Config{Image: "texlive"})
		svc := NewService(c)

		buildDir := t.TempDir()
		_ = os.WriteFile(filepath.Join(buildDir, "main.tex"), []byte("content"), 0644)

		res, err := svc.Compile(ctx, buildDir, "pdflatex", "main.tex")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if res.Success {
			t.Error("expected res.Success to be false")
		}
	})

	t.Run("Compilation succeeds but PDF missing", func(t *testing.T) {
		setupMockDocker(t, 0, "success")
		c := New(Config{Image: "texlive"})
		svc := NewService(c)

		buildDir := t.TempDir()
		_ = os.WriteFile(filepath.Join(buildDir, "main.tex"), []byte("content"), 0644)
		// We explicitly do NOT create main.pdf to simulate a silent failure

		_, err := svc.Compile(ctx, buildDir, "pdflatex", "main.tex")
		if err == nil || !strings.Contains(err.Error(), "PDF was not generated") {
			t.Errorf("expected PDF missing error, got %v", err)
		}
	})

	t.Run("Compilation succeeds and PDF exists", func(t *testing.T) {
		setupMockDocker(t, 0, "success")
		c := New(Config{Image: "texlive"})
		svc := NewService(c)

		buildDir := t.TempDir()
		_ = os.WriteFile(filepath.Join(buildDir, "main.tex"), []byte("content"), 0644)
		_ = os.WriteFile(filepath.Join(buildDir, "main.pdf"), []byte("pdf data"), 0644)

		res, err := svc.Compile(ctx, buildDir, "pdflatex", "main.tex")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !res.Success {
			t.Error("expected success=true")
		}
		if res.PDFPath != filepath.Join(buildDir, "main.pdf") {
			t.Errorf("expected correct PDF path, got %q", res.PDFPath)
		}
	})
}
