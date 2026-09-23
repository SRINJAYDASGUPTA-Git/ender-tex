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

func (s *Service) SyncTeXView(
	ctx context.Context,
	projectDir string,
	mainFile string,
	file string,
	line int,
	column int,
) (*SyncTeXViewResult, error) {
	return s.compiler.SyncTeXView(
		ctx,
		projectDir,
		mainFile,
		file,
		line,
		column,
	)
}

func (s *Service) SyncTeXEdit(
	ctx context.Context,
	projectDir string,
	mainFile string,
	page int,
	x float64,
	y float64,
) (*SyncTeXEditResult, error) {
	return s.compiler.SyncTeXEdit(
		ctx,
		projectDir,
		mainFile,
		page,
		x,
		y,
	)
}
