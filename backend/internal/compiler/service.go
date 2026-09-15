package compiler

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

type Service struct {
	compiler *Compiler
}

func NewService(compiler *Compiler) *Service {
	return &Service{
		compiler: compiler,
	}
}

func (s *Service) Compile(
	ctx context.Context,
	buildDir string,
	engine string,
	mainFile string,
) (*Result, error) {
	result, err := s.compiler.Compile(
		ctx,
		buildDir,
		engine,
		mainFile,
	)
	if err != nil {
		return nil, err
	}

	if !result.Success {
		return result, nil
	}

	pdfPath := filepath.Join(
		buildDir,
		pdfName(mainFile),
	)

	if _, err := os.Stat(pdfPath); err != nil {
		return nil, fmt.Errorf(
			"compilation succeeded but PDF was not generated: %w",
			err,
		)
	}

	result.PDFPath = pdfPath

	return result, nil
}
