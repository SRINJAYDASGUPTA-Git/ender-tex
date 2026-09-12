package auth

import "net/http"

func RegisterRoutes(
	mux *http.ServeMux,
	handler *Handler,
) {
	mux.HandleFunc("/api/auth/login", handler.Login)
	mux.HandleFunc("/api/auth/logout", handler.Logout)
	mux.HandleFunc("/api/auth/me", handler.Me)

	mux.Handle(
		"/api/admin/invitations",
		handler.requireAdmin(
			http.HandlerFunc(handler.CreateInvitation),
		),
	)

	mux.HandleFunc("/api/auth/accept-invitation", handler.AcceptInvitation)
}
