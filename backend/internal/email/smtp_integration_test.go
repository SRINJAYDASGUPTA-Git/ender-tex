//go:build integration

package email

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"paper-server/internal/email"
)

func TestSendInvitation_NetworkFailure(t *testing.T) {
	// Arrange: Point to a local port that is guaranteed to reject connections
	service, err := email.NewSMTPService("127.0.0.1", "12345", "user", "pass", "from@test.com")
	require.NoError(t, err)

	// Act
	err = service.SendInvitation(
		"invitee@example.com",
		"John Doe",
		"Quantum Mechanics Paper",
		"http://localhost/invite/123",
		time.Now().Add(24*time.Hour),
	)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "connect to SMTP server", "Expected network connection refusal")
}
