package database_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"paper-server/internal/database"
)

func TestOpen_Success(t *testing.T) {
	// Isolate the database file to a temporary directory
	tempDir := t.TempDir()
	t.Setenv("PAPER_SERVER_DATA_DIR", tempDir)

	db, err := database.Open()
	require.NoError(t, err, "Failed to open database")
	defer db.Close()

	// Ensure the connection is actually alive
	err = db.Ping()
	assert.NoError(t, err, "Failed to ping database")
}

func TestMigrate_Success(t *testing.T) {
	tempDir := t.TempDir()

	// Create a mock "migrations" folder inside the temp directory
	migrationsDir := filepath.Join(tempDir, "migrations")
	err := os.Mkdir(migrationsDir, 0755)
	require.NoError(t, err)

	// Write dummy migration files
	migration1 := "CREATE TABLE test_users (id TEXT PRIMARY KEY, name TEXT);"
	err = os.WriteFile(filepath.Join(migrationsDir, "001_init.sql"), []byte(migration1), 0644)
	require.NoError(t, err)

	migration2 := "ALTER TABLE test_users ADD COLUMN role TEXT;"
	err = os.WriteFile(filepath.Join(migrationsDir, "002_add_role.sql"), []byte(migration2), 0644)
	require.NoError(t, err)

	// Temporarily change the working directory so Migrate() finds our fake "migrations" folder
	originalWD, _ := os.Getwd()
	err = os.Chdir(tempDir)
	require.NoError(t, err)
	defer os.Chdir(originalWD)

	t.Setenv("PAPER_SERVER_DATA_DIR", tempDir)
	db, err := database.Open()
	require.NoError(t, err)
	defer db.Close()

	// Act: Run migrations for the first time
	err = database.Migrate(db)
	assert.NoError(t, err, "First migration run failed")

	// Assert: Check if the table was created
	var tableName string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='test_users';").Scan(&tableName)
	assert.NoError(t, err, "test_users table should exist")
	assert.Equal(t, "test_users", tableName)

	// Assert: Check schema_migrations tracking table
	var appliedCount int
	err = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&appliedCount)
	assert.NoError(t, err)
	assert.Equal(t, 2, appliedCount, "Should have tracked exactly 2 migrations")

	// Act: Run migrations a second time to ensure idempotency (skips already applied)
	err = database.Migrate(db)
	assert.NoError(t, err, "Second migration run failed (idempotency issue)")
}
