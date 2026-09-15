package project

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrInvalidPath       = errors.New("invalid project file path")
	ErrFileNotFound      = errors.New("file not found")
	ErrAlreadyExists     = errors.New("path already exists")
	ErrIsDirectory       = errors.New("path is a directory")
	ErrNotDirectory      = errors.New("path is not a directory")
	ErrDirectoryNotEmpty = errors.New("directory is not empty")
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

func (s *Storage) FilePath(
	projectID string,
	filePath string,
) (string, error) {
	return s.safeFilePath(projectID, filePath)
}

func (s *Storage) CopyProjectTo(
	projectID string,
	destination string,
) error {
	entries, err := s.ListFiles(projectID)
	if err != nil {
		return fmt.Errorf("list project files: %w", err)
	}

	for _, entry := range entries {
		// Generated PDF is not source.
		if entry.Path == "current.pdf" {
			continue
		}

		sourcePath, err := s.safeFilePath(
			projectID,
			entry.Path,
		)
		if err != nil {
			return err
		}

		destinationPath := filepath.Join(
			destination,
			filepath.FromSlash(entry.Path),
		)

		if entry.Type == "directory" {
			if err := os.MkdirAll(
				destinationPath,
				0755,
			); err != nil {
				return fmt.Errorf(
					"create directory: %w",
					err,
				)
			}

			continue
		}

		if err := os.MkdirAll(
			filepath.Dir(destinationPath),
			0755,
		); err != nil {
			return fmt.Errorf(
				"create parent directory: %w",
				err,
			)
		}

		src, err := os.Open(sourcePath)
		if err != nil {
			return fmt.Errorf(
				"open %s: %w",
				entry.Path,
				err,
			)
		}

		dst, err := os.Create(destinationPath)
		if err != nil {
			src.Close()
			return fmt.Errorf(
				"create %s: %w",
				entry.Path,
				err,
			)
		}

		_, copyErr := io.Copy(dst, src)

		src.Close()
		dst.Close()

		if copyErr != nil {
			return fmt.Errorf(
				"copy %s: %w",
				entry.Path,
				copyErr,
			)
		}
	}

	return nil
}

func (s *Storage) CreateProject(projectID, mainFile string) error {
	projectPath := s.ProjectPath(projectID)

	if err := os.MkdirAll(projectPath, 0755); err != nil {
		return fmt.Errorf("create project directory: %w", err)
	}
	filePath, err := s.safeFilePath(projectID, mainFile)
	if err != nil {
		return err
	}

	content := `\documentclass{article}

\begin{document}

\section{Introduction}

Start writing your paper here.

\end{document}
`

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("create main file: %w", err)
	}

	return nil
}

func (s *Storage) ListFiles(projectID string) ([]FileEntry, error) {
	projectPath := s.ProjectPath(projectID)

	var entries []FileEntry

	err := filepath.Walk(projectPath, func(
		path string,
		info os.FileInfo,
		err error,
	) error {
		if err != nil {
			return err
		}

		// Don't include the project root itself.
		if path == projectPath {
			return nil
		}

		relativePath, err := filepath.Rel(projectPath, path)
		if err != nil {
			return err
		}

		entryType := "file"
		if info.IsDir() {
			entryType = "directory"
		}

		entries = append(entries, FileEntry{
			Path: filepath.ToSlash(relativePath),
			Name: info.Name(),
			Type: entryType,
		})

		return nil
	})

	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}

		return nil, fmt.Errorf("list project files: %w", err)
	}

	return entries, nil
}

func (s *Storage) ReadFile(projectID, filePath string) ([]byte, error) {
	path, err := s.safeFilePath(projectID, filePath)
	fmt.Println("path", path)
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

func (s *Storage) DeleteProject(projectID string) error {
	return os.RemoveAll(s.ProjectPath(projectID))
}
func (s *Storage) CreateFile(projectID, filePath string) error {
	path, err := s.safeFilePath(projectID, filePath)
	if err != nil {
		return err
	}

	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("file already exists")
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("check file: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create file directory: %w", err)
	}

	if err := os.WriteFile(path, []byte{}, 0644); err != nil {
		return fmt.Errorf("create project file: %w", err)
	}

	return nil
}

func (s *Storage) DeleteFile(projectID, filePath string) error {
	path, err := s.safeFilePath(projectID, filePath)
	if err != nil {
		return err
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}

		return fmt.Errorf("stat project file: %w", err)
	}

	if info.IsDir() {
		return errors.New("path is a directory")
	}

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete project file: %w", err)
	}

	return nil
}

func (s *Storage) RenameFile(
	projectID string,
	oldPath string,
	newPath string,
) error {
	source, err := s.safeFilePath(projectID, oldPath)
	if err != nil {
		return err
	}

	destination, err := s.safeFilePath(projectID, newPath)
	if err != nil {
		return err
	}

	info, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}

		return fmt.Errorf("stat source file: %w", err)
	}

	if info.IsDir() {
		return errors.New("source path is a directory")
	}

	if _, err := os.Stat(destination); err == nil {
		return errors.New("destination already exists")
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("check destination: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		return fmt.Errorf("create destination directory: %w", err)
	}

	if err := os.Rename(source, destination); err != nil {
		return fmt.Errorf("rename project file: %w", err)
	}

	return nil
}

func (s *Storage) CreateDirectory(
	projectID string,
	dirPath string,
) error {
	path, err := s.safeFilePath(projectID, dirPath)
	if err != nil {
		return err
	}

	if _, err := os.Stat(path); err == nil {
		return errors.New("directory already exists")
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("check directory: %w", err)
	}

	if err := os.MkdirAll(path, 0755); err != nil {
		return fmt.Errorf("create project directory: %w", err)
	}

	return nil
}

func (s *Storage) DeleteDirectory(
	projectID string,
	dirPath string,
) error {
	path, err := s.safeFilePath(projectID, dirPath)
	if err != nil {
		return err
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}

		return fmt.Errorf("stat directory: %w", err)
	}

	if !info.IsDir() {
		return errors.New("path is not a directory")
	}

	// Do not silently delete an entire directory tree.
	entries, err := os.ReadDir(path)
	if err != nil {
		return fmt.Errorf("read directory: %w", err)
	}

	if len(entries) > 0 {
		return errors.New("directory is not empty")
	}

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete project directory: %w", err)
	}

	return nil
}

func (s *Storage) RenameDirectory(
	projectID string,
	oldPath string,
	newPath string,
) error {
	source, err := s.safeFilePath(projectID, oldPath)
	if err != nil {
		return err
	}

	destination, err := s.safeFilePath(projectID, newPath)
	if err != nil {
		return err
	}

	info, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}

		return fmt.Errorf("stat source directory: %w", err)
	}

	if !info.IsDir() {
		return ErrNotDirectory
	}

	if _, err := os.Stat(destination); err == nil {
		return ErrAlreadyExists
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("check destination: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		return fmt.Errorf("create destination directory: %w", err)
	}

	if err := os.Rename(source, destination); err != nil {
		return fmt.Errorf("rename project directory: %w", err)
	}

	return nil
}

func copyFile(
	source string,
	destination string,
) error {
	src, err := os.Open(source)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}
