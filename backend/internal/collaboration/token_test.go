package collaboration

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenService_IssueAndVerify(t *testing.T) {
	secret := "super-secret-test-key"
	svc, err := newTokenService(secret)
	require.NoError(t, err)

	userID := "user-123"
	token, err := svc.Issue(userID)
	require.NoError(t, err, "Failed to issue token")
	assert.NotEmpty(t, token)

	verifiedUserID, err := svc.Verify(token)
	require.NoError(t, err, "Failed to verify valid token")
	assert.Equal(t, userID, verifiedUserID)
}

func TestTokenService_InvalidSecret(t *testing.T) {
	_, err := newTokenService("   ")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "secret cannot be empty")
}

func TestTokenService_VerifyFailures(t *testing.T) {
	svc, err := newTokenService("valid-secret")
	require.NoError(t, err)

	t.Run("Missing Parts", func(t *testing.T) {
		_, err := svc.Verify("invalid-token-without-dot")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration token")
	})

	t.Run("Tampered Signature", func(t *testing.T) {
		validToken, _ := svc.Issue("user-123")
		tamperedToken := validToken + "tamper"
		_, err := svc.Verify(tamperedToken)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration token signature")
	})

	t.Run("Invalid Payload Base64", func(t *testing.T) {
		invalidPayload := "%%invalid%%"
		signature := base64.RawURLEncoding.EncodeToString([]byte("fake-sig"))
		_, err := svc.Verify(invalidPayload + "." + signature)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration token signature")
	})
}
