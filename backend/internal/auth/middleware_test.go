package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestContextExtraction(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	expectedID := "test-user-uuid"

	ctx := withUserID(req.Context(), expectedID)
	userID, ok := UserIDFromContext(ctx)

	if !ok {
		t.Error("UserID should be successfully retrieved from context")
	}
	if userID != expectedID {
		t.Errorf("expected %s, got %s", expectedID, userID)
	}

	_, ok = UserIDFromContext(req.Context())
	if ok {
		t.Error("Context without user ID should return false")
	}
}

func TestMiddleware_RequireAuth(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)

	user, err := service.CreateUser("mid@example.com", "Mid User", "password123", RoleCollaborator)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	_, token, err := service.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	dummy := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		extractedUser, ok := userFromContext(r.Context())
		if !ok || extractedUser.ID != user.ID {
			t.Error("user missing from context")
		}
		w.WriteHeader(http.StatusOK)
	})

	protected := handler.RequireAuth(dummy)

	t.Run("no cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("invalid cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "bad"})
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
	})
}

func TestMiddleware_RequireAdmin(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)

	collabUser, err := service.CreateUser("collab@example.com", "Collab", "password123", RoleCollaborator)
	if err != nil {
		t.Fatalf("failed to create collab user: %v", err)
	}
	_, collabToken, _ := service.CreateSession(collabUser.ID)

	adminUser, err := service.CreateUser("admin@example.com", "Admin", "password123", RoleAdmin)
	if err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}
	_, adminToken, _ := service.CreateSession(adminUser.ID)

	dummy := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	protected := handler.RequireAdmin(dummy)

	t.Run("collaborator forbidden", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: collabToken})
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		if rr.Code != http.StatusForbidden {
			t.Errorf("expected 403, got %d", rr.Code)
		}
	})

	t.Run("admin success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: adminToken})
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", rr.Code)
		}
	})
}
