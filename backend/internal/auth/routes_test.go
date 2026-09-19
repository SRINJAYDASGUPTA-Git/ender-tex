package auth

import (
	"net/http"
	"testing"
)

func TestRegisterRoutes(t *testing.T) {
	service, _, _ := newTestService(t)
	handler := NewHandler(service)
	mux := http.NewServeMux()

	RegisterRoutes(mux, handler)

	tests := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/auth/login"},
		{http.MethodPost, "/api/auth/logout"},
		{http.MethodGet, "/api/auth/me"},
		{http.MethodPost, "/api/admin/invitations"},
		{http.MethodPost, "/api/auth/accept-invitation"},
		{http.MethodGet, "/api/auth/invitation"},
	}

	for _, tt := range tests {
		req, _ := http.NewRequest(tt.method, tt.path, nil)
		_, pattern := mux.Handler(req)

		if pattern == "" {
			t.Errorf("route %s %s not registered", tt.method, tt.path)
		}
	}
}
