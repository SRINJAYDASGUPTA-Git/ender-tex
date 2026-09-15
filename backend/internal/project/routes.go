package project

import (
	"net/http"
	"strings"

	"paper-server/internal/auth"
)

func RegisterRoutes(
	mux *http.ServeMux,
	handler *Handler,
	authHandler *auth.Handler,
) {
	mux.Handle(
		"/api/projects",
		authHandler.RequireAuth(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.Method {
				case http.MethodGet:
					handler.List(w, r)

				case http.MethodPost:
					handler.Create(w, r)

				default:
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
			}),
		),
	)

	mux.Handle(
		"/api/projects/",
		authHandler.RequireAuth(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/compile"):
					handler.Compile(w, r)
				case strings.HasSuffix(r.URL.Path, "/files"):
					handler.Files(w, r)

				case strings.Contains(r.URL.Path, "/files/"):
					handler.File(w, r)

				case strings.HasSuffix(r.URL.Path, "/folders"):
					http.Error(
						w,
						"method not allowed",
						http.StatusMethodNotAllowed,
					)

				case strings.Contains(r.URL.Path, "/folders/"):
					switch r.Method {
					case http.MethodPost:
						handler.CreateDirectory(w, r)

					case http.MethodPatch:
						handler.RenameDirectory(w, r)

					case http.MethodDelete:
						handler.DeleteDirectory(w, r)

					default:
						http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
					}

				default:
					if r.Method != http.MethodGet {
						w.WriteHeader(http.StatusMethodNotAllowed)
						return
					}

					handler.Get(w, r)
				}
			}),
		),
	)
}
