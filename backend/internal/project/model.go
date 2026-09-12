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

type Project struct {
	ID           string    `json:"id"`
	OwnerID      string    `json:"ownerId"`
	Name         string    `json:"name"`
	MainFile     string    `json:"mainFile"`
	Engine       string    `json:"engine"`
	Bibliography string    `json:"bibliography"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type CreateProjectRequest struct {
	Name         string `json:"name"`
	MainFile     string `json:"mainFile"`
	Engine       string `json:"engine"`
	Bibliography string `json:"bibliography"`
}	