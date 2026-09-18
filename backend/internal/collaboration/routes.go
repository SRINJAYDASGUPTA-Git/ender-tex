package collaboration

import (
	"net/http"

	"paper-server/internal/auth"
)

func RegisterRoutes(
	mux *http.ServeMux,
	server *Server,
	authHandler *auth.Handler,
) {
	mux.Handle(
		"/api/yjs/{room}",
		server,
	)

	mux.Handle(
		"/api/collaboration/token",
		authHandler.RequireAuth(
			http.HandlerFunc(server.Token),
		),
	)
}