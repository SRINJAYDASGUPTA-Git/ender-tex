package email_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"paper-server/internal/email"
)

func TestNewSMTPService_Success(t *testing.T) {
	// Act
	// This implicitly tests that the go:embed directive worked
	// and that templates/invitation.html contains valid Go template syntax.
	service, err := email.NewSMTPService("smtp.test.local", "587", "user", "pass", "no-reply@endertex.com")

	// Assert
	assert.NoError(t, err, "Failed to initialize SMTP service and parse embedded template")
	assert.NotNil(t, service)
}
