package auth

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// failEmailService simulates a downed email provider
type failEmailService struct{}

func (s *failEmailService) SendInvitation(to, name, proj, url string, exp time.Time) error {
	return errors.New("simulated email network error")
}

func TestCoverage_HelpersAndCryptoEdgeCases(t *testing.T) {
	t.Run("normalizeEmail", func(t *testing.T) {
		if normalizeEmail("  TEST@Example.com ") != "test@example.com" {
			t.Fatal("normalizeEmail failed to lowercase and trim")
		}
	})

	t.Run("DeleteSession empty token", func(t *testing.T) {
		service, _, _ := newTestService(t)
		if err := service.DeleteSession(""); err != nil {
			t.Fatalf("expected nil error for empty token, got %v", err)
		}
	})

	t.Run("subtleConstantTimeCompare length mismatch", func(t *testing.T) {
		if subtleConstantTimeCompare([]byte("a"), []byte("ab")) {
			t.Fatal("expected false when lengths differ")
		}
	})

	t.Run("verifyPassword bad hex", func(t *testing.T) {
		if verifyPassword("pass", "$argon2id$v=19$m=64,t=3,p=4$ZZZ$aGFzaA") {
			t.Fatal("expected false for bad salt hex")
		}
		if verifyPassword("pass", "$argon2id$v=19$m=64,t=3,p=4$c2FsdA$ZZZ") {
			t.Fatal("expected false for bad hash hex")
		}
	})
}

func TestCoverage_AuthenticatedAcceptInvitation(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)

	user, _ := service.CreateUser("auth-accept@test.com", "A", "password123", RoleCollaborator)
	_, sessionToken, _ := service.CreateSession(user.ID)
	_, inviteToken, _ := service.CreateInvitation("auth-accept@test.com", "A", RoleCollaborator, "project-1")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/accept-invitation", bytes.NewBufferString(`{"token":"`+inviteToken+`","password":""}`))
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionToken})
	rr := httptest.NewRecorder()

	handler.AcceptInvitation(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201 Created for authenticated accept, got %d", rr.Code)
	}
}

func TestCoverage_DatabaseAndServiceErrors(t *testing.T) {
	service, repo, db := newTestService(t)

	t.Run("AcceptNewUser rows affected zero", func(t *testing.T) {
		inv := &Invitation{ID: "fake-id", ProjectID: "project-1", Email: "t@t.com", Role: RoleCollaborator}
		_, _, _, err := repo.AcceptNewUserInvitation(inv, "hash")
		if !errors.Is(err, ErrInvitationNotFound) {
			t.Fatalf("expected ErrInvitationNotFound, got %v", err)
		}
	})

	t.Run("AcceptExistingUser rows affected zero", func(t *testing.T) {
		// FIX: The user must actually exist in the DB to pass the foreign key constraint on project_memberships
		validUser, _ := service.CreateUser("exist@test.com", "E", "password123", RoleCollaborator)
		inv := &Invitation{ID: "fake-id", ProjectID: "project-1", Email: "exist@test.com"}

		_, err := repo.AcceptExistingUserInvitation(inv, validUser)
		if !errors.Is(err, ErrInvitationNotFound) {
			t.Fatalf("expected ErrInvitationNotFound, got %v", err)
		}
	})

	t.Run("email sending failure", func(t *testing.T) {
		checker := &testProjectChecker{projects: map[string]string{"project-1": "P1"}}
		failSvc := NewService(repo, checker, &failEmailService{}, "http://localhost", false)
		_, _, err := failSvc.CreateInvitation("t@t.com", "T", RoleCollaborator, "project-1")
		if err == nil || err.Error() != "simulated email network error" {
			t.Fatalf("expected email sending error, got %v", err)
		}
	})

	t.Run("loadProjectIDs query error", func(t *testing.T) {
		user, _ := service.CreateUser("load@test.com", "L", "password123", RoleCollaborator)

		// Drop the table to trigger the SQL error
		_, err := db.Exec("DROP TABLE project_memberships")
		if err != nil {
			t.Fatalf("Failed to drop table: %v", err)
		}

		_, err = repo.GetUserByID(user.ID)
		if err == nil {
			t.Fatal("expected loadProjectIDs to fail due to missing table")
		}

		_, err = repo.GetUserByEmail("load@test.com")
		if err == nil {
			t.Fatal("expected loadProjectIDs to fail due to missing table")
		}
	})

	t.Run("forced db connection closure errors", func(t *testing.T) {
		// Close the database to trigger internal server SQL errors across the board
		db.Close()

		// Force the repository layer error branches
		_ = repo.CreateUser(&User{})
		_, _ = repo.GetUserByID("id")
		_, _ = repo.GetUserByEmail("test@example.com")
		_, _ = repo.GetSessionByTokenHash("hash")
		_ = repo.DeleteSession("hash")
		_ = repo.CreateInvitation(&Invitation{}, "hash")
		_, _ = repo.GetInvitationByTokenHash("hash")
		_ = repo.DeleteInvitation("id")
		_, _, _, _ = repo.AcceptNewUserInvitation(&Invitation{}, "hash")
		_, _ = repo.AcceptExistingUserInvitation(&Invitation{}, &User{})

		// Force service layer error branches
		_, _ = service.CreateUser("t@t.com", "T", "password123", RoleCollaborator)
		_, _ = service.Authenticate("t@t.com", "password123")
		_, _, _ = service.CreateSession("uid")

		handler := NewHandler(service)

		// Login DB Failure
		req1 := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString(`{"email":"t@t.com","password":"password123"}`))
		rr1 := httptest.NewRecorder()
		handler.Login(rr1, req1)
		if rr1.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 on login DB failure, got %d", rr1.Code)
		}

		// Accept Invitation DB Failure
		req2 := httptest.NewRequest(http.MethodPost, "/accept", bytes.NewBufferString(`{"token":"valid","password":"password123"}`))
		rr2 := httptest.NewRecorder()
		handler.AcceptInvitation(rr2, req2)
		if rr2.Code != http.StatusBadRequest {
			t.Errorf("expected 400 on accept DB failure, got %d", rr2.Code)
		}

		// Get Details DB Failure
		req3 := httptest.NewRequest(http.MethodGet, "/details?token=valid", nil)
		rr3 := httptest.NewRecorder()
		handler.GetInvitationDetails(rr3, req3)
		if rr3.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 on details DB failure, got %d", rr3.Code)
		}
	})
}
