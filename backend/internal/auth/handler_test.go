package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandler_Login(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	_, _ = service.CreateUser("login@example.com", "Login User", "password123", RoleCollaborator)

	tests := []struct {
		name           string
		method         string
		body           string
		expectedStatus int
	}{
		{"wrong method", http.MethodGet, `{}`, http.StatusMethodNotAllowed},
		{"bad json", http.MethodPost, `{bad}`, http.StatusBadRequest},
		{"invalid credentials", http.MethodPost, `{"email":"login@example.com","password":"wrong"}`, http.StatusUnauthorized},
		{"success", http.MethodPost, `{"email":"login@example.com","password":"password123"}`, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/auth/login", bytes.NewBufferString(tt.body))
			rr := httptest.NewRecorder()
			handler.Login(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected %d, got %d", tt.expectedStatus, rr.Code)
			}
			if tt.expectedStatus == http.StatusOK {
				cookies := rr.Result().Cookies()
				if len(cookies) == 0 || cookies[0].Name != sessionCookieName {
					t.Error("expected session cookie to be set")
				}
			}
		})
	}
}

func TestHandler_Logout(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	user, _ := service.CreateUser("logout@example.com", "Logout User", "password123", RoleCollaborator)
	_, token, _ := service.CreateSession(user.ID)

	t.Run("wrong method", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/logout", nil)
		rr := httptest.NewRecorder()
		handler.Logout(rr, req)
		if rr.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", rr.Code)
		}
	})

	t.Run("success with cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()
		handler.Logout(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Errorf("expected 204, got %d", rr.Code)
		}

		_, err := service.GetUserBySessionToken(token)
		if err == nil {
			t.Error("expected session to be deleted")
		}
	})

	t.Run("success without cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
		rr := httptest.NewRecorder()
		handler.Logout(rr, req)
		if rr.Code != http.StatusNoContent {
			t.Errorf("expected 204, got %d", rr.Code)
		}
	})
}

func TestHandler_Me(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	user, _ := service.CreateUser("me@example.com", "Me User", "password123", RoleCollaborator)
	_, token, _ := service.CreateSession(user.ID)

	t.Run("wrong method", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/me", nil)
		rr := httptest.NewRecorder()
		handler.Me(rr, req)
		if rr.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", rr.Code)
		}
	})

	t.Run("no cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
		rr := httptest.NewRecorder()
		handler.Me(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("invalid cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "invalid"})
		rr := httptest.NewRecorder()
		handler.Me(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()
		handler.Me(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}

		var resp User
		if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.Email != "me@example.com" {
			t.Errorf("expected email me@example.com, got %s", resp.Email)
		}
	})
}

func TestHandler_CreateInvitation(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)

	tests := []struct {
		name           string
		method         string
		body           string
		expectedStatus int
	}{
		{"wrong method", http.MethodGet, `{}`, http.StatusMethodNotAllowed},
		{"bad json", http.MethodPost, `{bad}`, http.StatusBadRequest},
		{"missing fields", http.MethodPost, `{"email":""}`, http.StatusBadRequest},
		{"success", http.MethodPost, `{"email":"invite@example.com","name":"Invitee","project_id":"project-1"}`, http.StatusCreated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/admin/invitations", bytes.NewBufferString(tt.body))
			rr := httptest.NewRecorder()
			handler.CreateInvitation(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected %d, got %d", tt.expectedStatus, rr.Code)
			}
		})
	}
}

func TestHandler_AcceptInvitation(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	_, token, _ := service.CreateInvitation("accept@example.com", "Accept", RoleCollaborator, "project-1")

	tests := []struct {
		name           string
		method         string
		body           string
		expectedStatus int
	}{
		{"wrong method", http.MethodGet, `{}`, http.StatusMethodNotAllowed},
		{"bad json", http.MethodPost, `{bad}`, http.StatusBadRequest},
		{"invalid token", http.MethodPost, `{"token":"bad","password":"password123"}`, http.StatusBadRequest},
		{"success", http.MethodPost, `{"token":"` + token + `","password":"password123"}`, http.StatusCreated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/auth/accept-invitation", bytes.NewBufferString(tt.body))
			rr := httptest.NewRecorder()
			handler.AcceptInvitation(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected %d, got %d", tt.expectedStatus, rr.Code)
			}
		})
	}
}

func TestHandler_GetInvitationDetails(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	_, token, _ := service.CreateInvitation("details@example.com", "Details", RoleCollaborator, "project-1")

	t.Run("success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/invitation?token="+token, nil)
		rr := httptest.NewRecorder()
		handler.GetInvitationDetails(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
	})

	t.Run("missing token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/invitation", nil)
		rr := httptest.NewRecorder()
		handler.GetInvitationDetails(rr, req)
		if rr.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rr.Code)
		}
	})
}
