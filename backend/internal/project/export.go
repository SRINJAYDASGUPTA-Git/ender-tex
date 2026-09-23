package project

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func (s *Storage) ExportProject(
	projectID string,
	mainFile string,
	includePDF bool,
	writer io.Writer,
) error {
	projectPath := s.ProjectPath(projectID)

	if _, err := os.Stat(projectPath); err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}

		return fmt.Errorf("inspect project: %w", err)
	}

	archive := zip.NewWriter(writer)

	mainPDF := pdfNameForMainFile(mainFile)

	err := filepath.Walk(
		projectPath,
		func(
			path string,
			info os.FileInfo,
			err error,
		) error {
			if err != nil {
				return err
			}

			if path == projectPath {
				return nil
			}

			relativePath, err := filepath.Rel(
				projectPath,
				path,
			)
			if err != nil {
				return err
			}

			relativePath = filepath.ToSlash(
				relativePath,
			)

			if info.IsDir() {
				return nil
			}

			if isGeneratedArtifact(relativePath) {
				return nil
			}

			if relativePath == "current.pdf" {
				return nil
			}

			if relativePath == mainPDF &&
				!includePDF {
				return nil
			}

			file, err := os.Open(path)
			if err != nil {
				return fmt.Errorf(
					"open %s: %w",
					relativePath,
					err,
				)
			}

			entry, err := archive.Create(
				relativePath,
			)

			if err != nil {
				_ = file.Close()

				return fmt.Errorf(
					"create archive entry %s: %w",
					relativePath,
					err,
				)
			}

			_, copyErr := io.Copy(
				entry,
				file,
			)

			_ = file.Close()

			if copyErr != nil {
				return fmt.Errorf(
					"archive %s: %w",
					relativePath,
					copyErr,
				)
			}

			return nil
		},
	)

	if err != nil {
		_ = archive.Close()
		return err
	}

	return archive.Close()
}

func pdfNameForMainFile(mainFile string) string {
	name := filepath.Base(mainFile)

	if strings.HasSuffix(
		strings.ToLower(name),
		".tex",
	) {
		name = name[:len(name)-4]
	}

	return name + ".pdf"
}
