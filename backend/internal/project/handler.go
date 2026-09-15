package project

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"paper-server/internal/auth"
	"paper-server/internal/compiler"
)

type Handler struct {
	service  *Service
	storage  *Storage
	compiler *compiler.Service
}

func NewHandler(
	service *Service,
	storage *Storage,
	compilerService *compiler.Service,
) *Handler {
	return &Handler{
		service:  service,
		storage:  storage,
		compiler: compilerService,
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
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": err.Error(),
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

	project, err := h.service.GetForUser(id, userID)

	if err != nil {
		handleProjectAccessError(w, err)
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
		handleProjectAccessError(w, err)
		return
	}

	files, err := h.storage.ListFiles(projectID)
	if err != nil {
		handleProjectAccessError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"files": files,
	})
}

func (h *Handler) File(w http.ResponseWriter, r *http.Request) {
	projectID, filePath, ok := projectFileFromPath(r.URL.Path)
	filePath = filePath[6:]
	fmt.Println("projectID/filePath", projectID, filePath)
	if !ok {
		http.Error(w, "invalid file path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.readFile(w, projectID, filePath)

	case http.MethodPost:
		h.createFile(w, projectID, filePath)

	case http.MethodPut:
		h.writeFile(w, r, projectID, filePath)

	case http.MethodPatch:
		h.renameFile(w, r, projectID, filePath)

	case http.MethodDelete:
		h.deleteFile(w, projectID, filePath)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) Compile(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	projectID, ok := projectIDFromPath(r.URL.Path)
	if !ok {
		http.Error(
			w,
			"invalid project path",
			http.StatusBadRequest,
		)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(
			w,
			"Unauthorized",
			http.StatusUnauthorized,
		)
		return
	}

	p, err := h.service.GetForUser(
		projectID,
		userID,
	)
	if err != nil {
		handleProjectAccessError(w, err)
		return
	}

	buildDir, err := os.MkdirTemp(
		"",
		"endertex-build-*",
	)
	if err != nil {
		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]string{
				"message": "Failed to create build workspace.",
			},
		)
		return
	}
	defer os.RemoveAll(buildDir)

	if err := h.storage.CopyProjectTo(
		projectID,
		buildDir,
	); err != nil {
		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]string{
				"message": err.Error(),
			},
		)
		return
	}

	result, err := h.compiler.Compile(
		r.Context(),
		buildDir,
		p.Engine,
		p.MainFile,
	)
	if err != nil {
		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]string{
				"message": err.Error(),
			},
		)
		return
	}

	if result.Success {
		currentPDF := filepath.Join(
			h.storage.ProjectPath(projectID),
			"current.pdf",
		)

		if err := copyFile(
			result.PDFPath,
			currentPDF,
		); err != nil {
			writeJSON(
				w,
				http.StatusInternalServerError,
				map[string]string{
					"message": "Failed to save compiled PDF.",
				},
			)
			return
		}
	}

	result.PDFPath = ""

	writeJSON(
		w,
		http.StatusOK,
		result,
	)
}

func (h *Handler) PDF(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	projectID, ok := projectIDFromPath(r.URL.Path)
	if !ok {
		http.Error(
			w,
			"invalid project path",
			http.StatusBadRequest,
		)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(
			w,
			"Unauthorized",
			http.StatusUnauthorized,
		)
		return
	}

	if _, err := h.service.GetForUser(
		projectID,
		userID,
	); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	pdfPath := filepath.Join(
		h.storage.ProjectPath(projectID),
		"current.pdf",
	)

	if _, err := os.Stat(pdfPath); err != nil {
		if os.IsNotExist(err) {
			http.Error(
				w,
				"PDF not found. Compile the project first.",
				http.StatusNotFound,
			)
			return
		}

		http.Error(
			w,
			"internal server error",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set(
		"Content-Disposition",
		`inline; filename="current.pdf"`,
	)

	http.ServeFile(w, r, pdfPath)
}
// ==============================
// CRUD Files
// ==============================

func (h *Handler) createFile(
	w http.ResponseWriter,
	projectID string,
	filePath string,
) {
	if err := h.storage.CreateFile(projectID, filePath); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid file path", http.StatusBadRequest)

		case errors.Is(err, ErrAlreadyExists):
			http.Error(w, "file already exists", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"path": filePath,
	})
}
func (h *Handler) deleteFile(
	w http.ResponseWriter,
	projectID string,
	filePath string,
) {
	if err := h.storage.DeleteFile(projectID, filePath); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid file path", http.StatusBadRequest)

		case errors.Is(err, ErrFileNotFound):
			http.Error(w, "file not found", http.StatusNotFound)

		case errors.Is(err, ErrIsDirectory):
			http.Error(w, "path is a directory", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) renameFile(
	w http.ResponseWriter,
	r *http.Request,
	projectID string,
	filePath string,
) {
	var request struct {
		NewPath string `json:"newPath"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	request.NewPath = strings.TrimSpace(request.NewPath)

	if request.NewPath == "" {
		http.Error(w, "new path is required", http.StatusBadRequest)
		return
	}

	if err := h.storage.RenameFile(
		projectID,
		filePath,
		request.NewPath,
	); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid file path", http.StatusBadRequest)

		case errors.Is(err, ErrFileNotFound):
			http.Error(w, "file not found", http.StatusNotFound)

		case errors.Is(err, ErrAlreadyExists):
			http.Error(w, "destination already exists", http.StatusConflict)

		case errors.Is(err, ErrIsDirectory):
			http.Error(w, "path is a directory", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"oldPath": filePath,
		"newPath": request.NewPath,
	})
}

// ==============================
// CRUD Folder
// ==============================

func (h *Handler) CreateDirectory(w http.ResponseWriter, r *http.Request) {
	projectID, dirPath, ok := projectDirectoryFromPath(r.URL.Path)
	fmt.Println("projectID/dirPath", projectID, dirPath)
	if !ok {
		http.Error(w, "invalid directory path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	dirPath = dirPath[8:]

	if err := h.storage.CreateDirectory(projectID, dirPath); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid directory path", http.StatusBadRequest)

		case errors.Is(err, ErrAlreadyExists):
			http.Error(w, "directory already exists", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"path": dirPath,
	})
}

func (h *Handler) DeleteDirectory(w http.ResponseWriter, r *http.Request) {
	projectID, dirPath, ok := projectDirectoryFromPath(r.URL.Path)
	if !ok {
		http.Error(w, "invalid directory path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	dirPath = dirPath[8:]

	if err := h.storage.DeleteDirectory(projectID, dirPath); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid directory path", http.StatusBadRequest)

		case errors.Is(err, ErrFileNotFound):
			http.Error(w, "directory not found", http.StatusNotFound)

		case errors.Is(err, ErrNotDirectory):
			http.Error(w, "path is not a directory", http.StatusConflict)

		case errors.Is(err, ErrDirectoryNotEmpty):
			http.Error(w, "directory is not empty", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) RenameDirectory(w http.ResponseWriter, r *http.Request) {
	projectID, dirPath, ok := projectDirectoryFromPath(r.URL.Path)
	if !ok {
		http.Error(w, "invalid directory path", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if _, err := h.service.GetForUser(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	var request struct {
		NewPath string `json:"newPath"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	request.NewPath = strings.TrimSpace(request.NewPath)

	if request.NewPath == "" {
		http.Error(w, "new path is required", http.StatusBadRequest)
		return
	}

	if err := h.storage.RenameDirectory(
		projectID,
		dirPath,
		request.NewPath,
	); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPath):
			http.Error(w, "invalid directory path", http.StatusBadRequest)

		case errors.Is(err, ErrFileNotFound):
			http.Error(w, "directory not found", http.StatusNotFound)

		case errors.Is(err, ErrAlreadyExists):
			http.Error(w, "destination already exists", http.StatusConflict)

		case errors.Is(err, ErrNotDirectory):
			http.Error(w, "path is not a directory", http.StatusConflict)

		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"oldPath": dirPath,
		"newPath": request.NewPath,
	})
}

// ==============================
// Helper Functions
// ==============================
func handleProjectAccessError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrProjectNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{
			"message": "Project not found.",
		})

	case errors.Is(err, ErrProjectAccessDenied):
		writeJSON(w, http.StatusForbidden, map[string]string{
			"message": "You do not have access to this project.",
		})

	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to access project.",
		})
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

func projectDirectoryFromPath(path string) (string, string, bool) {
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
