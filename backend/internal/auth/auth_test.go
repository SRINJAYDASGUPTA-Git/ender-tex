package auth

import (
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type testProjectChecker struct {
	projects map[string]string
}

func (c *testProjectChecker) Exists(projectID string) (bool, error) {
	_, ok := c.projects[projectID]
	return ok, nil
}

func (c *testProjectChecker) GetName(projectID string) (string, error) {
	name, ok := c.projects[projectID]
	if !ok {
		return "", errors.New("project not found")
	}

	return name, nil
}

type testEmailService struct {
	sent          bool
	to            string
	name          string
	projectName   string
	invitationURL string
	expiresAt     time.Time
}

func (s *testEmailService) SendInvitation(
	to string,
	name string,
	projectName string,
	invitationURL string,
	expiresAt time.Time,
) error {
	s.sent = true
	s.to = to
	s.name = name
	s.projectName = projectName
	s.invitationURL = invitationURL
	s.expiresAt = expiresAt

	return nil
}

func newTestService(t *testing.T) (*Service, *Repository, *sql.DB) {
	t.Helper()

	db := newTestDB(t)

	// Seed the database with a dummy project to satisfy foreign key constraints
	// on the invitations and project_memberships tables.
	_, err := db.Exec(`
		INSERT INTO users (id, email, password_hash, role, name) 
		VALUES ('dummy-owner', 'owner@example.com', 'hash', 'COLLABORATOR', 'Owner');
		
		INSERT INTO projects (id, owner_id, name, main_file, engine, bibliography) 
		VALUES ('project-1', 'dummy-owner', 'Test Project', 'main.tex', 'pdflatex', 'biber');
	`)
	if err != nil {
		t.Fatalf("failed to seed test database: %v", err)
	}

	repository := NewRepository(db)

	checker := &testProjectChecker{
		projects: map[string]string{
			"project-1": "Test Project",
		},
	}

	emailSender := &testEmailService{}

	service := NewService(
		repository,
		checker,
		emailSender,
		"http://localhost:3000",
		false,
	)

	return service, repository, db
}

func TestServiceCreateUser(t *testing.T) {
	service, repository, _ := newTestService(t)

	t.Run("creates user", func(t *testing.T) {
		user, err := service.CreateUser(
			"Test@Example.COM ",
			"John Doe",
			"password123",
			RoleCollaborator,
		)

		if err != nil {
			t.Fatalf("CreateUser() error = %v", err)
		}

		if user.ID == "" {
			t.Fatal("expected user ID")
		}

		if user.Email != "test@example.com" {
			t.Fatalf("expected normalized email, got %q", user.Email)
		}

		if user.Name != "John Doe" {
			t.Fatalf("expected name %q, got %q", "John Doe", user.Name)
		}

		if user.Role != RoleCollaborator {
			t.Fatalf("expected role %q, got %q", RoleCollaborator, user.Role)
		}

		if user.PasswordHash == "" {
			t.Fatal("expected password hash to be generated")
		}

		if !strings.HasPrefix(user.PasswordHash, "$argon2id$") {
			t.Fatalf("expected Argon2id hash, got %q", user.PasswordHash)
		}

		stored, err := repository.GetUserByID(user.ID)
		if err != nil {
			t.Fatalf("GetUserByID() error = %v", err)
		}

		if stored.Email != "test@example.com" {
			t.Fatalf("stored email = %q", stored.Email)
		}

		if stored.PasswordHash == "" {
			t.Fatal("expected stored password hash")
		}

		// Fixed argument order: verifyPassword(password, hash)
		if !verifyPassword("password123", stored.PasswordHash) {
			t.Fatal("stored password hash does not verify")
		}
	})

	t.Run("rejects empty email", func(t *testing.T) {
		_, err := service.CreateUser(
			"",
			"John Doe",
			"password123",
			RoleCollaborator,
		)

		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("rejects short password", func(t *testing.T) {
		_, err := service.CreateUser(
			"user@example.com",
			"John Doe",
			"short",
			RoleCollaborator,
		)

		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("rejects duplicate email", func(t *testing.T) {
		_, err := service.CreateUser(
			"duplicate@example.com",
			"First User",
			"password123",
			RoleCollaborator,
		)
		if err != nil {
			t.Fatalf("first CreateUser() error = %v", err)
		}

		_, err = service.CreateUser(
			"DUPLICATE@example.com",
			"Second User",
			"password123",
			RoleCollaborator,
		)

		if err == nil {
			t.Fatal("expected duplicate email error")
		}
	})
}

func TestServiceAuthenticate(t *testing.T) {
	service, _, _ := newTestService(t)

	_, err := service.CreateUser(
		"test@example.com",
		"Test User",
		"correct-password",
		RoleCollaborator,
	)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	t.Run("authenticates valid credentials", func(t *testing.T) {
		user, err := service.Authenticate(
			"TEST@EXAMPLE.COM ",
			"correct-password",
		)

		if err != nil {
			t.Fatalf("Authenticate() error = %v", err)
		}

		if user.Email != "test@example.com" {
			t.Fatalf(
				"expected email %q, got %q",
				"test@example.com",
				user.Email,
			)
		}
	})

	t.Run("rejects wrong password", func(t *testing.T) {
		_, err := service.Authenticate(
			"test@example.com",
			"wrong-password",
		)

		if !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf(
				"expected ErrInvalidCredentials, got %v",
				err,
			)
		}
	})

	t.Run("rejects unknown email", func(t *testing.T) {
		_, err := service.Authenticate(
			"unknown@example.com",
			"correct-password",
		)

		if !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf(
				"expected ErrInvalidCredentials, got %v",
				err,
			)
		}
	})
}

func TestServiceCreateSession(t *testing.T) {
	service, _, _ := newTestService(t)

	user, err := service.CreateUser(
		"user@example.com",
		"Test User",
		"password123",
		RoleCollaborator,
	)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	session, token, err := service.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	if session.ID == "" {
		t.Fatal("expected session ID")
	}

	if token == "" {
		t.Fatal("expected session token")
	}

	if session.UserID != user.ID {
		t.Fatalf(
			"expected session user ID %q, got %q",
			user.ID,
			session.UserID,
		)
	}

	if session.TokenHash == token {
		t.Fatal("session must store token hash, not raw token")
	}

	if len(session.TokenHash) != 64 {
		t.Fatalf(
			"expected SHA-256 hex hash length 64, got %d",
			len(session.TokenHash),
		)
	}

	if !session.ExpiresAt.After(time.Now()) {
		t.Fatal("expected session to expire in the future")
	}
}

func TestServiceGetUserBySessionToken(t *testing.T) {
	service, _, _ := newTestService(t)

	user, err := service.CreateUser(
		"user@example.com",
		"Test User",
		"password123",
		RoleCollaborator,
	)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	_, token, err := service.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	t.Run("returns user for valid token", func(t *testing.T) {
		result, err := service.GetUserBySessionToken(token)
		if err != nil {
			t.Fatalf(
				"GetUserBySessionToken() error = %v",
				err,
			)
		}

		if result.ID != user.ID {
			t.Fatalf(
				"expected user ID %q, got %q",
				user.ID,
				result.ID,
			)
		}
	})

	t.Run("rejects empty token", func(t *testing.T) {
		_, err := service.GetUserBySessionToken("")

		if !errors.Is(err, ErrSessionNotFound) {
			t.Fatalf(
				"expected ErrSessionNotFound, got %v",
				err,
			)
		}
	})

	t.Run("rejects invalid token", func(t *testing.T) {
		_, err := service.GetUserBySessionToken(
			"definitely-not-a-valid-token",
		)

		if !errors.Is(err, ErrSessionNotFound) {
			t.Fatalf(
				"expected ErrSessionNotFound, got %v",
				err,
			)
		}
	})
}

func TestServiceDeleteSession(t *testing.T) {
	service, _, _ := newTestService(t)

	user, err := service.CreateUser(
		"user@example.com",
		"Test User",
		"password123",
		RoleCollaborator,
	)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	_, token, err := service.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}

	if err := service.DeleteSession(token); err != nil {
		t.Fatalf("DeleteSession() error = %v", err)
	}

	_, err = service.GetUserBySessionToken(token)

	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf(
			"expected ErrSessionNotFound after deletion, got %v",
			err,
		)
	}
}

func TestServicePasswordHashing(t *testing.T) {
	password := "correct-password"

	hash, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}

	t.Logf("generated hash: %s", hash)

	if hash == password {
		t.Fatal("password must not be stored in plaintext")
	}

	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf(
			"expected Argon2id hash, got %q",
			hash,
		)
	}

	t.Run("valid password", func(t *testing.T) {
		if !verifyPassword(password, hash) {
			t.Fatal("expected password verification to succeed")
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		if verifyPassword("wrong-password", hash) {
			t.Fatal("expected password verification to fail")
		}
	})
}

func TestServicePasswordHashValidation(t *testing.T) {
	tests := []struct {
		name string
		hash string
	}{
		{
			name: "empty hash",
			hash: "",
		},
		{
			name: "random string",
			hash: "not-a-password-hash",
		},
		{
			name: "wrong algorithm",
			hash: "$bcrypt$some-value",
		},
		{
			name: "malformed argon2 hash",
			hash: "$argon2id$v=19$m=65536,t=3,p=4$bad",
		},
		{
			name: "invalid parameters",
			hash: "$argon2id$v=19$m=invalid,t=3,p=4$c2FsdA$aGFzaA",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if verifyPassword("password", tt.hash) {
				t.Fatal("expected malformed hash to fail verification")
			}
		})
	}
}

func TestServiceCreateAdmin(t *testing.T) {
	service, _, _ := newTestService(t)

	user, err := service.CreateAdmin(
		"admin@example.com",
		"Admin",
		"admin-password",
	)
	if err != nil {
		t.Fatalf("CreateAdmin() error = %v", err)
	}

	if user.Role != RoleAdmin {
		t.Fatalf(
			"expected role %q, got %q",
			RoleAdmin,
			user.Role,
		)
	}
}

func TestServiceCreateInvitation(t *testing.T) {
	service, _, _ := newTestService(t)

	emailSender := service.emailSender.(*testEmailService)

	t.Run("creates invitation", func(t *testing.T) {
		invitation, token, err := service.CreateInvitation(
			"Test@Example.COM ",
			"John Doe",
			RoleCollaborator,
			"project-1",
		)

		if err != nil {
			t.Fatalf(
				"CreateInvitation() error = %v",
				err,
			)
		}

		if invitation.ID == "" {
			t.Fatal("expected invitation ID")
		}

		if token == "" {
			t.Fatal("expected invitation token")
		}

		if invitation.Email != "test@example.com" {
			t.Fatalf(
				"expected normalized email, got %q",
				invitation.Email,
			)
		}

		if invitation.ProjectID != "project-1" {
			t.Fatalf(
				"expected project ID %q, got %q",
				"project-1",
				invitation.ProjectID,
			)
		}

		if invitation.Name != "John Doe" {
			t.Fatalf(
				"expected name %q, got %q",
				"John Doe",
				invitation.Name,
			)
		}

		if !emailSender.sent {
			t.Fatal("expected invitation email to be sent")
		}

		if emailSender.to != "test@example.com" {
			t.Fatalf(
				"email recipient = %q",
				emailSender.to,
			)
		}

		if emailSender.projectName != "Test Project" {
			t.Fatalf(
				"project name = %q",
				emailSender.projectName,
			)
		}

		if !strings.Contains(
			emailSender.invitationURL,
			"/accept-invitation?token="+token,
		) {
			t.Fatalf(
				"invitation URL does not contain token: %q",
				emailSender.invitationURL,
			)
		}

		if !emailSender.expiresAt.After(time.Now()) {
			t.Fatal("expected invitation expiry to be in the future")
		}
	})

	t.Run("rejects empty email", func(t *testing.T) {
		_, _, err := service.CreateInvitation(
			"",
			"John Doe",
			RoleCollaborator,
			"project-1",
		)

		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("rejects invalid role", func(t *testing.T) {
		_, _, err := service.CreateInvitation(
			"user@example.com",
			"John Doe",
			RoleAdmin,
			"project-1",
		)

		if err == nil {
			t.Fatal("expected invalid role error")
		}
	})

	t.Run("rejects empty project ID", func(t *testing.T) {
		_, _, err := service.CreateInvitation(
			"user@example.com",
			"John Doe",
			RoleCollaborator,
			"",
		)

		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("rejects nonexistent project", func(t *testing.T) {
		_, _, err := service.CreateInvitation(
			"user@example.com",
			"John Doe",
			RoleCollaborator,
			"does-not-exist",
		)

		if err == nil {
			t.Fatal("expected project-not-found error")
		}
	})
}

func TestServiceAcceptInvitation(t *testing.T) {
	service, repository, _ := newTestService(t)

	_, token, err := service.CreateInvitation(
		"newuser@example.com",
		"New User",
		RoleCollaborator,
		"project-1",
	)
	if err != nil {
		t.Fatalf("CreateInvitation() error = %v", err)
	}

	t.Run("accepts invitation for new user", func(t *testing.T) {
		result, err := service.AcceptInvitation(
			token,
			"new-password",
			nil,
		)
		if err != nil {
			t.Fatalf(
				"AcceptInvitation() error = %v",
				err,
			)
		}

		if result.User.Email != "newuser@example.com" {
			t.Fatalf(
				"expected email %q, got %q",
				"newuser@example.com",
				result.User.Email,
			)
		}

		if result.User.Name != "New User" {
			t.Fatalf(
				"expected name %q, got %q",
				"New User",
				result.User.Name,
			)
		}

		if result.ProjectID != "project-1" {
			t.Fatalf(
				"expected project ID %q, got %q",
				"project-1",
				result.ProjectID,
			)
		}

		if result.SessionToken == "" {
			t.Fatal("expected session token")
		}

		_, err = service.AcceptInvitation(
			token,
			"new-password",
			nil,
		)

		if !errors.Is(err, ErrInvitationNotFound) {
			t.Fatalf(
				"expected ErrInvitationNotFound after acceptance, got %v",
				err,
			)
		}

		user, err := repository.GetUserByEmail(
			"newuser@example.com",
		)
		if err != nil {
			t.Fatalf(
				"GetUserByEmail() error = %v",
				err,
			)
		}

		if user.ID != result.User.ID {
			t.Fatalf(
				"expected persisted user ID %q, got %q",
				result.User.ID,
				user.ID,
			)
		}
	})
}

func TestServiceAcceptExistingUserInvitation(t *testing.T) {
	service, _, _ := newTestService(t)

	user, err := service.CreateUser(
		"existing@example.com",
		"Existing User",
		"password123",
		RoleCollaborator,
	)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	_, token, err := service.CreateInvitation(
		"existing@example.com",
		"Existing User",
		RoleCollaborator,
		"project-1",
	)
	if err != nil {
		t.Fatalf("CreateInvitation() error = %v", err)
	}

	t.Run("requires authenticated user", func(t *testing.T) {
		_, err := service.AcceptInvitation(
			token,
			"",
			nil,
		)

		if err == nil {
			t.Fatal("expected authentication error")
		}
	})

	_, token2, err := service.CreateInvitation(
		"existing@example.com",
		"Existing User",
		RoleCollaborator,
		"project-1",
	)
	if err != nil {
		t.Fatalf("CreateInvitation() error = %v", err)
	}

	t.Run("rejects different authenticated user", func(t *testing.T) {
		otherUser, err := service.CreateUser(
			"other@example.com",
			"Other User",
			"password123",
			RoleCollaborator,
		)
		if err != nil {
			t.Fatalf("CreateUser() error = %v", err)
		}

		_, err = service.AcceptInvitation(
			token2,
			"",
			otherUser,
		)

		if err == nil {
			t.Fatal("expected email mismatch error")
		}
	})

	_, token3, err := service.CreateInvitation(
		"existing@example.com",
		"Existing User",
		RoleCollaborator,
		"project-1",
	)
	if err != nil {
		t.Fatalf("CreateInvitation() error = %v", err)
	}

	t.Run("accepts matching authenticated user", func(t *testing.T) {
		result, err := service.AcceptInvitation(
			token3,
			"",
			user,
		)
		if err != nil {
			t.Fatalf(
				"AcceptInvitation() error = %v",
				err,
			)
		}

		if result.User.ID != user.ID {
			t.Fatalf(
				"expected user ID %q, got %q",
				user.ID,
				result.User.ID,
			)
		}

		if result.SessionToken != "" {
			t.Fatal(
				"existing users should not receive a new session",
			)
		}
	})
}

func TestServiceGetInvitationDetails(t *testing.T) {
	service, _, _ := newTestService(t)

	t.Run("returns invitation", func(t *testing.T) {
		_, token, err := service.CreateInvitation(
			"user@example.com",
			"User",
			RoleCollaborator,
			"project-1",
		)
		if err != nil {
			t.Fatalf("CreateInvitation() error = %v", err)
		}

		invitation, err := service.GetInvitationDetails(token)
		if err != nil {
			t.Fatalf(
				"GetInvitationDetails() error = %v",
				err,
			)
		}

		if invitation.Email != "user@example.com" {
			t.Fatalf(
				"expected email %q, got %q",
				"user@example.com",
				invitation.Email,
			)
		}
	})

	t.Run("rejects empty token", func(t *testing.T) {
		_, err := service.GetInvitationDetails("")

		if !errors.Is(err, ErrInvitationNotFound) {
			t.Fatalf(
				"expected ErrInvitationNotFound, got %v",
				err,
			)
		}
	})

	t.Run("rejects invalid token", func(t *testing.T) {
		_, err := service.GetInvitationDetails(
			"invalid-token",
		)

		if !errors.Is(err, ErrInvitationNotFound) {
			t.Fatalf(
				"expected ErrInvitationNotFound, got %v",
				err,
			)
		}
	})
}

func TestServiceTokenHashing(t *testing.T) {
	token := "test-token"

	hash := hashToken(token)

	if hash == token {
		t.Fatal("token hash must differ from raw token")
	}

	if len(hash) != 64 {
		t.Fatalf(
			"expected SHA-256 hex hash length 64, got %d",
			len(hash),
		)
	}

	if hashToken(token) != hash {
		t.Fatal("hashToken must be deterministic")
	}

	if hashToken("different-token") == hash {
		t.Fatal("different tokens must have different hashes")
	}
}

func TestServiceGenerateToken(t *testing.T) {
	token1, err := generateToken()
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}

	token2, err := generateToken()
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}

	if token1 == "" || token2 == "" {
		t.Fatal("expected non-empty tokens")
	}

	if token1 == token2 {
		t.Fatal("expected independently generated tokens to differ")
	}

	if _, err := uuid.Parse(token1); err == nil {
		t.Fatal("token should not be a UUID-formatted value")
	}
}
