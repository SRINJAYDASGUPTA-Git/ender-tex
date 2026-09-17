package project

import "time"

const (
	EnginePDFLaTeX = "pdflatex"
	EngineLaTeX    = "latex"
	EngineXeLaTeX  = "xelatex"
	EngineLuaLaTeX = "lualatex"

	BibliographyBiber  = "biber"
	BibliographyBibTeX = "bibtex"

	PermissionViewer = "VIEWER"
	PermissionEditor = "EDITOR"
)

type ProjectMembership struct {
	ID         string    `json:"id"`
	ProjectID  string    `json:"projectId"`
	UserID     string    `json:"userId"`
	Name       string    `json:"name"`
	Email      string    `json:"email"`
	Permission string    `json:"permission"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Project struct {
	ID           string              `json:"id"`
	OwnerID      string              `json:"ownerId"`
	Name         string              `json:"name"`
	MainFile     string              `json:"mainFile"`
	Engine       string              `json:"engine"`
	Bibliography string              `json:"bibliography"`
	CreatedAt    time.Time           `json:"createdAt"`
	UpdatedAt    time.Time           `json:"updatedAt"`
	Memberships  []ProjectMembership `json:"memberships"`
}

type CreateProjectRequest struct {
	Name         string `json:"name"`
	MainFile     string `json:"mainFile"`
	Engine       string `json:"engine"`
	Bibliography string `json:"bibliography"`
}

type FileEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Type string `json:"type"`
}
