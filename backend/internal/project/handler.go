package project

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"paper-server/internal/auth"
)

type Handler struct {
	service *Service
	storage *Storage
}

func NewHandler(service *Service, storage *Storage) *Handler {
	return &Handler{
		service: service,
		storage: storage,
	}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var request CreateProjectRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Invalid request body.",
		})
		return
	}

	project, err := h.service.Create(userID, request)

	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusCreated, project)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	projects, err := h.service.List(userID)

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to load projects.",
		})
		return
	}

	writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/projects/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Project ID is required.",
		})
		return
	}
	
	if _, err := h.service.GetForUser(id, userID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"message": "Forbidden.",
		})
		return
	}

	project, err := h.service.Get(id)

	if errors.Is(err, ErrProjectNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"message": "Project not found.",
		})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to load project.",
		})
		return
	}

	// For now, ownership is the only access rule.
	// Membership access will be added next.
	if project.OwnerID != userID {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"message": "You do not have access to this project.",
		})
		return
	}

	writeJSON(w, http.StatusOK, project)
}

func (h *Handler) Files(w http.ResponseWriter, r *http.Request) {
	
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID, ok := projectIDFromPath(r.URL.Path)
	if !ok {
		http.Error(w, "invalid project path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"message": "Forbidden.",
		})
		return
	}

	files, err := h.storage.ListFiles(projectID)
	if err != nil {
		if errors.Is(err, ErrFileNotFound) {
			http.Error(w, "project not found", http.StatusNotFound)
			return
		}

		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"files": files,
	})
}

func (h *Handler) File(w http.ResponseWriter, r *http.Request) {
	projectID, filePath, projectOk := projectFileFromPath(r.URL.Path)
	if !projectOk {
		http.Error(w, "invalid file path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"message": "Forbidden.",
		})
		return
	}
	

	switch r.Method {
	case http.MethodGet:
		h.readFile(w, projectID, filePath)

	case http.MethodPut:
		h.writeFile(w, r, projectID, filePath)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) readFile(
	w http.ResponseWriter,
	projectID string,
	filePath string,
) {
	content, err := h.storage.ReadFile(projectID, filePath)
	if err != nil {
		switch {
		case errors.Is(err, ErrFileNotFound):
			http.Error(w, "file not found", http.StatusNotFound)

		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid file path", http.StatusBadRequest)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"path":    filePath,
		"content": string(content),
	})
}

func (h *Handler) writeFile(
	w http.ResponseWriter,
	r *http.Request,
	projectID string,
	filePath string,
) {
	var req struct {
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.storage.WriteFile(
		projectID,
		filePath,
		[]byte(req.Content),
	); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid file path", http.StatusBadRequest)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"path": filePath,
	})
}

func projectIDFromPath(path string) (string, bool) {
	const prefix = "/api/projects/"

	if !strings.HasPrefix(path, prefix) {
		return "", false
	}

	rest := strings.TrimPrefix(path, prefix)

	parts := strings.Split(rest, "/")

	if len(parts) < 2 || parts[0] == "" {
		return "", false
	}

	return parts[0], true
}

func projectFileFromPath(path string) (string, string, bool) {
	const prefix = "/api/projects/"

	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}

	rest := strings.TrimPrefix(path, prefix)

	parts := strings.SplitN(rest, "/", 2)

	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}

	return parts[0], parts[1], true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}