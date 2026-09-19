package email

import (
	"time"

	"github.com/stretchr/testify/mock"
)

// MockService implements email.Service for use in other module tests.
type MockService struct {
	mock.Mock
}

func (m *MockService) SendInvitation(recipient string, name string, projectName string, inviteURL string, expiresAt time.Time) error {
	args := m.Called(recipient, name, projectName, inviteURL, expiresAt)
	return args.Error(0)
}
