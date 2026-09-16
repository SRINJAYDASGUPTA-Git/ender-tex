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

var ErrProjectAccessDenied = errors.New("project access denied")
// var ErrProjectNotFound = errors.New("project not found")
var ErrProjectForbidden = errors.New("project forbidden")

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

	if err := s.storage.CreateProject(project.ID, mainFile); err != nil {
		return nil, fmt.Errorf("initialize project files: %w", err)
	}

	if err := s.repository.Create(project); err != nil {
		_ = s.storage.DeleteProject(project.ID)

		return nil, fmt.Errorf("create project: %w", err)
	}

	return project, nil
}

func (s *Service) List(userID string) ([]*Project, error) {
	return s.repository.ListByOwnerOrMember(userID)
}

func (s *Service) Get(id string) (*Project, error) {
	return s.repository.GetByID(id)
}

func (s *Service) GetForUser(projectID, userID string) (*Project, error) {
	project, err := s.repository.GetByID(projectID)
	if err != nil {
		return nil, err
	}

	if project.OwnerID == userID {
		return project, nil
	}

	member, err := s.repository.IsMember(projectID, userID)
	if err != nil {
		return nil, err
	}

	if !member {
		return nil, ErrProjectAccessDenied
	}

	return project, nil
}

func (s *Service) RenameProject(
    projectID string,
    userID string,
    name string,
) (*Project, error) {
    project, err := s.repository.GetByID(projectID)
    if err != nil {
        return nil, err
    }

    if project.OwnerID != userID {
        return nil, ErrProjectForbidden
    }

    name = strings.TrimSpace(name)

    if name == "" {
        return nil, errors.New("project name cannot be empty")
    }

    if len(name) > 200 {
        return nil, errors.New("project name is too long")
    }

    if err := s.repository.UpdateProjectName(projectID, name); err != nil {
        return nil, err
    }

    project.Name = name

    return project, nil
}

func (s *Service) DeleteProject(
    projectID string,
    userID string,
) error {
    project, err := s.repository.GetByID(projectID)
    if err != nil {
        return err
    }

    if project.OwnerID != userID {
        return ErrProjectForbidden
    }

    if err := s.storage.DeleteProject(projectID); err != nil {
        return fmt.Errorf("delete project files: %w", err)
    }

    if err := s.repository.DeleteProject(projectID); err != nil {
        return fmt.Errorf("delete project metadata: %w", err)
    }

    return nil
}

func (s *Service) GetForOwner(
	projectID string,
	userID string,
) (*Project, error) {
	project, err := s.repository.GetByID(projectID)
	if err != nil {
		return nil, err
	}

	if project.OwnerID != userID {
		return nil, ErrProjectAccessDenied
	}

	return project, nil
}

func (s *Service) ListMembers(projectID string) ([]*ProjectMembership, error) {
    return s.repository.ListMembers(projectID)
}

func (s *Service) ListInvitations(projectID string) ([]*Invitation, error) {
    return s.repository.ListInvitationsByProject(projectID)
}

func (s *Service) UpdateMember(
    projectID string,
    userID string,
    permission string,
) error {
    if permission != PermissionEditor && permission != PermissionViewer {
        return errors.New("invalid permission")
    }

    return s.repository.UpdateMemberPermission(
        projectID,
        userID,
        permission,
    )
}

func (s *Service) RemoveMember(
    projectID string,
    userID string,
) error {
    return s.repository.RemoveMember(projectID, userID)
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
