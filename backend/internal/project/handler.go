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

type RenameProjectRequest struct {
	Name string `json:"name"`
}

type MemberUpdateRequest struct {
	Permission string `json:"permission"`
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

// Create creates a new LaTeX project for the authenticated user.
//
//	@Summary		Create project
//	@Description	Creates a new LaTeX project and assigns the authenticated user as its owner.
//	@Tags			Projects
//	@Accept			json
//	@Produce		json
//	@Param			request	body		CreateProjectRequest	true	"Project configuration"
//	@Success		201		{object}	Project
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{string}	string	"Unauthorized"
//	@Router			/projects [post]
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

// List returns all projects accessible to the authenticated user.
//
//	@Summary		List projects
//	@Description	Returns projects available to the authenticated user.
//	@Tags			Projects
//	@Produce		json
//	@Success		200	{array}		Project
//	@Failure		401	{string}	string	"Unauthorized"
//	@Failure		400	{object}	map[string]string
//	@Router			/projects [get]
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

// Get returns a project accessible to the authenticated user.
//
//	@Summary		Get project
//	@Description	Returns project metadata and membership information for a project.
//	@Tags			Projects
//	@Produce		json
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{object}	Project
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		404			{object}	map[string]string
//	@Router			/projects/{projectId} [get]
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("projectId")
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

// Files lists all files in a project.
//
//	@Summary		List project files
//	@Description	Returns the files and directories contained in a project.
//	@Tags			Files
//	@Produce		json
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{object}	map[string]interface{}
//	@Failure		400			{string}	string	"Invalid project path"
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		404			{object}	map[string]string
//	@Router			/projects/{projectId}/files [get]
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

// File handles file operations within a project.
//
//	@Summary		File operations
//	@Description	Provides read, create, update, rename, and delete operations for project files.
//	@Tags			Files
//	@Produce		json
//	@Param			projectId	path		string	true	"Project ID"
//	@Param			filePath	path		string	true	"Project-relative file path"
//	@Success		200			{object}	map[string]interface{}
//	@Success		201			{object}	map[string]string
//	@Success		204
//	@Failure		400	{string}	string	"Invalid file path or request"
//	@Failure		401	{string}	string	"Unauthorized"
//	@Failure		403	{object}	map[string]string
//	@Failure		404	{string}	string	"File not found"
//	@Failure		409	{string}	string	"File conflict"
//	@Failure		500	{string}	string	"Internal server error"
//	@Router			/projects/{projectId}/files/{filePath} [get]
//	@Router			/projects/{projectId}/files/{filePath} [post]
//	@Router			/projects/{projectId}/files/{filePath} [put]
//	@Router			/projects/{projectId}/files/{filePath} [patch]
//	@Router			/projects/{projectId}/files/{filePath} [delete]
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

// Compile compiles the project's main LaTeX document.
//
//	@Summary		Compile project
//	@Description	Compiles the project's main LaTeX document using the configured LaTeX engine.
//	@Tags			Compilation
//	@Produce		json
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{object}	compiler.Result
//	@Failure		400			{string}	string	"Invalid project path"
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		404			{object}	map[string]string
//	@Failure		500			{object}	map[string]string	"Compilation or server error"
//	@Router			/projects/{projectId}/compile [post]
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

// PDF returns the latest compiled PDF for a project.
//
//	@Summary		Get compiled PDF
//	@Description	Returns the most recently compiled PDF for the project.
//	@Tags			Compilation
//	@Produce		application/pdf
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{file}		binary
//	@Failure		400			{string}	string	"Invalid project path"
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		404			{string}	string	"PDF not found"
//	@Failure		500			{string}	string	"Internal server error"
//	@Router			/projects/{projectId}/pdf [get]
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

// RenameProject renames a project owned by the authenticated user.
//
//	@Summary		Rename project
//	@Description	Updates the name of a project owned by the authenticated user.
//	@Tags			Projects
//	@Accept			json
//	@Produce		json
//	@Param			projectId	path		string					true	"Project ID"
//	@Param			request		body		RenameProjectRequest	true	"New project name"
//	@Success		200			{object}	Project
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{string}	string	"Forbidden"
//	@Failure		404			{string}	string	"Project not found"
//	@Router			/projects/{projectId} [patch]
func (h *Handler) RenameProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID := r.PathValue("projectId")
	if projectID == "" {
		http.Error(w, "project id is required", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req RenameProjectRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	project, err := h.service.RenameProject(
		projectID,
		userID,
		req.Name,
	)

	if err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			http.Error(w, "project not found", http.StatusNotFound)

		case errors.Is(err, ErrProjectForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)

		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}

		return
	}

	writeJSON(w, http.StatusOK, project)
}

// DeleteProject deletes a project owned by the authenticated user.
//
//	@Summary		Delete project
//	@Description	Deletes a project and all of its stored files.
//	@Tags			Projects
//	@Param			projectId	path	string	true	"Project ID"
//	@Success		204
//	@Failure		401	{string}	string	"Unauthorized"
//	@Failure		403	{string}	string	"Forbidden"
//	@Failure		404	{string}	string	"Project not found"
//	@Failure		500	{string}	string	"Internal server error"
//	@Router			/projects/{projectId} [delete]
func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID := r.PathValue("projectId")
	if projectID == "" {
		http.Error(w, "project id is required", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.service.DeleteProject(projectID, userID); err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			http.Error(w, "project not found", http.StatusNotFound)

		case errors.Is(err, ErrProjectForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)

		default:
			http.Error(w, "failed to delete project", http.StatusInternalServerError)
		}

		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListMembers lists all members of a project
//
//	@Summary		List all members of a project
//	@Description	Returns a list of all members of the project
//	@Tags			Members
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{array}		ProjectMembership
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{object}	map[string]string
//	@Failure		500			{object}	map[string]string
//	@Router			/api/projects/{projectId}/members [get]
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
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

	if _, err := h.service.GetForOwner(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	members, err := h.service.repository.ListMembers(projectID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, members)
}

// ListInvitations lists all invitations for a project
//
//	@Summary		List all invitations for a project
//	@Description	Returns a list of all invitations for the project
//	@Tags			Invitations
//	@Param			projectId	path		string	true	"Project ID"
//	@Success		200			{array}		Invitation
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{object}	map[string]string
//	@Failure		500			{object}	map[string]string
//	@Router			/api/projects/{projectId}/invitations [get]
func (h *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) {
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

	if _, err := h.service.GetForOwner(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	invitations, err := h.service.ListInvitations(projectID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, invitations)
}

// UpdateMember updates a member's permission in a project
//
//	@Summary		Update a member's permission in a project
//	@Description	Updates the permission of a member in the project
//	@Tags			Members
//	@Param			projectId	path		string	true	"Project ID"
//	@Param			memberId	path		string	true	"Member ID"
//	@Param			permission	body		string	true	"Permission"
//	@Success		200			{object}	ProjectMembership
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{object}	map[string]string
//	@Failure		500			{object}	map[string]string
//	@Router			/api/projects/{projectId}/members/{userId} [patch]
func (h *Handler) UpdateMember(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
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

	if _, err := h.service.GetForOwner(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	var memberUpdateReq MemberUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&memberUpdateReq); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if memberUpdateReq.Permission != "EDITOR" && memberUpdateReq.Permission != "VIEWER" {
		http.Error(w, "invalid permission", http.StatusBadRequest)
		return
	}

	memberID := r.PathValue("userId")
	if err := h.service.UpdateMember(projectID, memberID, memberUpdateReq.Permission); err != nil {
		http.Error(w, "failed to update member", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, nil)
}

// RemoveMember removes a member from a project
//
//	@Summary		Remove a member from a project
//	@Description	Removes a member from the project
//	@Tags			Members
//	@Param			projectId	path		string	true	"Project ID"
//	@Param			memberId	path		string	true	"Member ID"
//	@Success		200			{object}	map[string]string
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{object}	map[string]string
//	@Failure		500			{object}	map[string]string
//	@Router			/api/projects/{projectId}/members/{userId} [delete]
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
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

	if _, err := h.service.GetForOwner(projectID, userID); err != nil {
		handleProjectAccessError(w, err)
		return
	}

	memberID := r.PathValue("userId")

	if err := h.service.RemoveMember(projectID, memberID); err != nil {
		http.Error(w, "failed to remove member", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, nil)
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

// CreateDirectory creates a directory inside a project.
//
//	@Summary		Create directory
//	@Description	Creates a new directory within the project.
//	@Tags			Folders
//	@Accept			json
//	@Produce		json
//	@Param			projectId	path		string	true	"Project ID"
//	@Param			folderPath	path		string	true	"Project-relative directory path"
//	@Success		201			{object}	map[string]string
//	@Failure		400			{string}	string	"Invalid directory path"
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		409			{string}	string	"Directory already exists"
//	@Failure		500			{string}	string	"Internal server error"
//	@Router			/projects/{projectId}/folders/{folderPath} [post]
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

// DeleteDirectory deletes an empty directory from a project.
//
//	@Summary		Delete directory
//	@Description	Deletes an empty directory from the project.
//	@Tags			Folders
//	@Produce		json
//	@Param			projectId	path	string	true	"Project ID"
//	@Param			folderPath	path	string	true	"Project-relative directory path"
//	@Success		204
//	@Failure		400	{string}	string	"Invalid directory path"
//	@Failure		401	{string}	string	"Unauthorized"
//	@Failure		403	{object}	map[string]string
//	@Failure		404	{string}	string	"Directory not found"
//	@Failure		409	{string}	string	"Directory is not empty"
//	@Failure		500	{string}	string	"Internal server error"
//	@Router			/projects/{projectId}/folders/{folderPath} [delete]
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

// RenameDirectory renames a directory within a project.
//
//	@Summary		Rename directory
//	@Description	Renames a project directory.
//	@Tags			Folders
//	@Accept			json
//	@Produce		json
//	@Param			projectId	path		string				true	"Project ID"
//	@Param			folderPath	path		string				true	"Project-relative directory path"
//	@Param			request		body		map[string]string	true	"New directory path"
//	@Success		200			{object}	map[string]string
//	@Failure		400			{string}	string	"Invalid request or directory path"
//	@Failure		401			{string}	string	"Unauthorized"
//	@Failure		403			{object}	map[string]string
//	@Failure		404			{string}	string	"Directory not found"
//	@Failure		409			{string}	string	"Destination already exists"
//	@Failure		500			{string}	string	"Internal server error"
//	@Router			/projects/{projectId}/folders/{folderPath} [patch]
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
