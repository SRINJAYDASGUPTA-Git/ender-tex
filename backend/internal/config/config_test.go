package config_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"paper-server/internal/config"
)

func TestLoad_Defaults(t *testing.T) {
	// Arrange: Clear environment variables to force defaults
	t.Setenv("PAPER_SERVER_HOST", "")
	t.Setenv("PAPER_SERVER_PORT", "")
	t.Setenv("PAPER_SERVER_DATA_DIR", "")
	t.Setenv("LATEX_IMAGE", "")
	t.Setenv("APP_URL", "")
	t.Setenv("COLLAB_TOKEN_SECRET", "")

	// Act
	cfg := config.Load()

	// Assert
	assert.Equal(t, "127.0.0.1", cfg.Host)
	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "./data", cfg.DataDir)
	assert.Equal(t, "texlive/texlive", cfg.LatexImage)
	assert.Equal(t, "http://localhost:3000", cfg.AppURL)
	assert.Equal(t, "development-only-change-this-secret", cfg.CollabTokenSecret)
}

func TestLoad_CustomValues(t *testing.T) {
	// Arrange: Set custom values
	t.Setenv("PAPER_SERVER_HOST", "0.0.0.0")
	t.Setenv("PAPER_SERVER_PORT", "9090")
	t.Setenv("SMTP_HOST", "smtp.example.com")
	t.Setenv("SMTP_USERNAME", "testuser")

	// Act
	cfg := config.Load()

	// Assert
	assert.Equal(t, "0.0.0.0", cfg.Host)
	assert.Equal(t, "9090", cfg.Port)
	assert.Equal(t, "smtp.example.com", cfg.SMTPHost)
	assert.Equal(t, "testuser", cfg.SMTPUsername)
}
