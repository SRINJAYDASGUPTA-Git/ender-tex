package project

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrInvalidPath = errors.New("invalid project file path")
	ErrFileNotFound = errors.New("file not found")
)

type Storage struct {
	root string
}

func NewStorage(root string) (*Storage, error) {
	if root == "" {
		return nil, errors.New("storage root cannot be empty")
	}

	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, fmt.Errorf("create storage root: %w", err)
	}

	return &Storage{
		root: root,
	}, nil
}

func (s *Storage) ProjectPath(projectID string) string {
	return filepath.Join(s.root, projectID)
}

func (s *Storage) CreateProject(projectID, mainFile string) error {
	projectPath := s.ProjectPath(projectID)

	if err := os.MkdirAll(projectPath, 0755); err != nil {
		return fmt.Errorf("create project directory: %w", err)
	}

	content := `\documentclass{article}

\begin{document}

\section{Introduction}

Start writing your paper here.

\end{document}
`

	if err := os.WriteFile(
		filepath.Join(projectPath, mainFile),
		[]byte(content),
		0644,
	); err != nil {
		return fmt.Errorf("create main file: %w", err)
	}

	return nil
}

func (s *Storage) ListFiles(projectID string) ([]string, error) {
	projectPath := s.ProjectPath(projectID)

	var files []string

	err := filepath.Walk(projectPath, func(
		path string,
		info os.FileInfo,
		err error,
	) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		relativePath, err := filepath.Rel(projectPath, path)
		if err != nil {
			return err
		}

		files = append(files, filepath.ToSlash(relativePath))

		return nil
	})

	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}

		return nil, fmt.Errorf("list project files: %w", err)
	}

	return files, nil
}

func (s *Storage) ReadFile(projectID, filePath string) ([]byte, error) {
	path, err := s.safeFilePath(projectID, filePath)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}

		return nil, fmt.Errorf("read project file: %w", err)
	}

	return data, nil
}

func (s *Storage) WriteFile(projectID, filePath string, content []byte) error {
	path, err := s.safeFilePath(projectID, filePath)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create file directory: %w", err)
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("write project file: %w", err)
	}

	return nil
}

func (s *Storage) safeFilePath(projectID, filePath string) (string, error) {
	if projectID == "" || filePath == "" {
		return "", ErrInvalidPath
	}

	// Always treat project file paths as relative paths.
	filePath = filepath.Clean(filepath.FromSlash(filePath))

	if filepath.IsAbs(filePath) {
		return "", ErrInvalidPath
	}

	if filePath == "." || filePath == ".." {
		return "", ErrInvalidPath
	}

	if strings.HasPrefix(filePath, ".."+string(os.PathSeparator)) {
		return "", ErrInvalidPath
	}

	projectPath := s.ProjectPath(projectID)
	fullPath := filepath.Join(projectPath, filePath)

	// Final containment check.
	relative, err := filepath.Rel(projectPath, fullPath)
	if err != nil {
		return "", ErrInvalidPath
	}

	if relative == ".." ||
		strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return "", ErrInvalidPath
	}

	return fullPath, nil
}