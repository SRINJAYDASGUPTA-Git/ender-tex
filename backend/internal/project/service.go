package project

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repository *Repository
	storage    *Storage
}

func NewService(
	repository *Repository,
	storage *Storage,
) *Service {
	return &Service{
		repository: repository,
		storage:    storage,
	}
}

func (s *Service) Create(
	ownerID string,
	request CreateProjectRequest,
) (*Project, error) {
	name := strings.TrimSpace(request.Name)

	if name == "" {
		return nil, errors.New("project name is required")
	}

	if len(name) > 200 {
		return nil, errors.New("project name is too long")
	}

	mainFile := strings.TrimSpace(request.MainFile)

	if mainFile == "" {
		mainFile = "main.tex"
	}

	if request.Engine == "" {
		request.Engine = EnginePDFLaTeX
	}

	if request.Bibliography == "" {
		request.Bibliography = BibliographyBiber
	}

	if !validEngine(request.Engine) {
		return nil, errors.New("invalid LaTeX engine")
	}

	if !validBibliography(request.Bibliography) {
		return nil, errors.New("invalid bibliography backend")
	}

	if err := validateMainFile(mainFile); err != nil {
		return nil, err
	}

	project := &Project{
		ID:           uuid.NewString(),
		OwnerID:      ownerID,
		Name:         name,
		MainFile:     mainFile,
		Engine:       request.Engine,
		Bibliography: request.Bibliography,
	}

	if err := s.repository.Create(project); err != nil {
		return nil, err
	}

	if err := s.storage.CreateProject(project.ID, mainFile); err != nil {
		// We don't want an orphaned DB project if filesystem creation fails.
		// This can be made transactional at the application level later.
		return nil, fmt.Errorf("initialize project files: %w", err)
	}

	return project, nil
}

func (s *Service) List(ownerID string) ([]*Project, error) {
	return s.repository.ListByOwner(ownerID)
}

func (s *Service) Get(id string) (*Project, error) {
	return s.repository.GetByID(id)
}

func validEngine(engine string) bool {
	switch engine {
	case EnginePDFLaTeX,
		EngineLaTeX,
		EngineXeLaTeX,
		EngineLuaLaTeX:
		return true
	default:
		return false
	}
}

func validBibliography(backend string) bool {
	switch backend {
	case BibliographyBiber,
		BibliographyBibTeX:
		return true
	default:
		return false
	}
}

func validateMainFile(path string) error {
	if path == "" {
		return errors.New("main file is required")
	}

	if path[0] == '/' {
		return errors.New("main file must be relative")
	}

	if strings.Contains(path, `\`) {
		return errors.New("main file contains invalid path separators")
	}

	if strings.Contains(path, "..") {
		return errors.New("main file contains invalid path traversal")
	}

	if !strings.HasSuffix(strings.ToLower(path), ".tex") {
		return errors.New("main file must have a .tex extension")
	}

	return nil
}