package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordHashing(t *testing.T) {
	password := "superSecurePassword123"

	// Act
	hash, err := hashPassword(password)
	require.NoError(t, err, "Hashing should not fail")

	// Assert format
	assert.NotEmpty(t, hash)
	assert.Contains(t, hash, "$argon2id$v=19$")

	// Assert successful verification
	assert.True(t, verifyPassword(password, hash), "Correct password should verify")

	// Assert failed verification
	assert.False(t, verifyPassword("wrongPassword", hash), "Incorrect password should fail")
}

func TestTokenGeneration(t *testing.T) {
	// Act
	token, err := generateToken()
	require.NoError(t, err)

	// generateToken returns 32 bytes hex-encoded, which is 64 characters
	assert.Len(t, token, 64)

	hash := hashToken(token)
	assert.Len(t, hash, 64)
	assert.NotEqual(t, token, hash, "Hash must not equal the raw token")
}
