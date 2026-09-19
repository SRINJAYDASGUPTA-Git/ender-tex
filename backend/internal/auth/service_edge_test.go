package auth

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestService_ExpirationAndEdgeCases(t *testing.T) {
	service, _, db := newTestService(t)
	user, _ := service.CreateUser("expire@example.com", "Test", "password123", RoleCollaborator)

	t.Run("cleans up expired session", func(t *testing.T) {
		token := "expired-session-token"
		hash := hashToken(token)
		_, err := db.Exec(`
			INSERT INTO sessions (id, user_id, token_hash, expires_at) 
			VALUES (?, ?, ?, ?)`,
			"old-session-id", user.ID, hash, time.Now().Add(-1*time.Hour),
		)
		if err != nil {
			t.Fatalf("Failed to insert expired session: %v", err)
		}

		_, err = service.GetUserBySessionToken(token)
		if !errors.Is(err, ErrSessionNotFound) {
			t.Fatalf("expected ErrSessionNotFound for expired session, got %v", err)
		}
	})

	t.Run("cleans up expired invitation details", func(t *testing.T) {
		token := "expired-invite-token"
		hash := hashToken(token)
		_, err := db.Exec(`
			INSERT INTO invitations (id, email, name, role, project_id, token_hash, expires_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			"old-invite-id", "invite@example.com", "Name", RoleCollaborator, "project-1", hash, time.Now().Add(-1*time.Hour),
		)
		if err != nil {
			t.Fatalf("Failed to insert expired invitation: %v", err)
		}

		_, err = service.GetInvitationDetails(token)
		if err == nil || err.Error() != "invitation has expired" {
			t.Fatalf("expected 'invitation has expired' error, got %v", err)
		}
	})

	t.Run("rejects expired invitation acceptance", func(t *testing.T) {
		token := "expired-invite-token-2"
		hash := hashToken(token)
		_, _ = db.Exec(`
			INSERT INTO invitations (id, email, name, role, project_id, token_hash, expires_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			"old-invite-id-2", "invite2@example.com", "Name", RoleCollaborator, "project-1", hash, time.Now().Add(-1*time.Hour),
		)

		_, err := service.AcceptInvitation(token, "password123", nil)
		if err == nil || err.Error() != "invitation has expired" {
			t.Fatalf("expected 'invitation has expired' error, got %v", err)
		}
	})

	t.Run("rejects short password on invitation accept", func(t *testing.T) {
		_, token, _ := service.CreateInvitation("short@example.com", "Short", RoleCollaborator, "project-1")

		_, err := service.AcceptInvitation(token, "short", nil)
		if err == nil || !strings.Contains(err.Error(), "at least 8 characters") {
			t.Fatalf("expected short password error, got %v", err)
		}
	})
}
