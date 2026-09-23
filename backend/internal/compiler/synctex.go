package compiler

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type SyncTeXViewResult struct {
	Page   int     `json:"page"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type SyncTeXEditResult struct {
	File   string `json:"file"`
	Line   int    `json:"line"`
	Column int    `json:"column"`
}

func (c *Compiler) SyncTeXView(
	ctx context.Context,
	projectDir string,
	mainFile string,
	file string,
	line int,
	column int,
) (*SyncTeXViewResult, error) {
	if line <= 0 {
		return nil, fmt.Errorf("line must be greater than zero")
	}

	if column < 0 {
		return nil, fmt.Errorf("column cannot be negative")
	}

	absoluteDir, err := filepath.Abs(projectDir)
	if err != nil {
		return nil, fmt.Errorf("resolve project directory: %w", err)
	}

	sourceFile, err := safeProjectPath(
		absoluteDir,
		file,
	)
	if err != nil {
		return nil, err
	}

	if _, err := os.Stat(sourceFile); err != nil {
		return nil, fmt.Errorf("source file not found: %w", err)
	}

	pdfFile := pdfName(mainFile)

	queryInput := fmt.Sprintf(
		"%d:%d:/workdir/%s",
		line,
		column,
		filepath.ToSlash(file),
	)

	queryOutput := filepath.ToSlash(
		filepath.Join("/workdir", pdfFile),
	)

	output, err := c.runSyncTeX(
		ctx,
		absoluteDir,
		"view",
		"-i",
		queryInput,
		"-o",
		queryOutput,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"synctex view: %w\n%s",
			err,
			output,
		)
	}

	return parseSyncTeXView(output)
}

func (c *Compiler) SyncTeXEdit(
	ctx context.Context,
	projectDir string,
	mainFile string,
	page int,
	x float64,
	y float64,
) (*SyncTeXEditResult, error) {
	if page <= 0 {
		return nil, fmt.Errorf("page must be greater than zero")
	}

	absoluteDir, err := filepath.Abs(projectDir)
	if err != nil {
		return nil, fmt.Errorf("resolve project directory: %w", err)
	}

	pdfFile := pdfName(mainFile)

	query := fmt.Sprintf(
		"%d:%f:%f:/workdir/%s",
		page,
		x,
		y,
		filepath.ToSlash(pdfFile),
	)

	output, err := c.runSyncTeX(
		ctx,
		absoluteDir,
		"edit",
		"-o",
		query,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"synctex edit: %w\n%s",
			err,
			output,
		)
	}

	return parseSyncTeXEdit(
		output,
		absoluteDir,
	)
}

func (c *Compiler) runSyncTeX(
	ctx context.Context,
	projectDir string,
	args ...string,
) (string, error) {
	absoluteDir, err := filepath.Abs(projectDir)
	if err != nil {
		return "", err
	}

	commandArgs := []string{
		"run",
		"--rm",
		"-v",
		fmt.Sprintf("%s:/workdir", absoluteDir),
		"-w",
		"/workdir",
		c.image,
		"synctex",
	}

	commandArgs = append(
		commandArgs,
		args...,
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	cmd := exec.CommandContext(
		ctx,
		"docker",
		commandArgs...,
	)

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()

	output := stdout.String() +
		stderr.String()

	if err != nil {
		return output, err
	}

	return output, nil
}

func parseSyncTeXView(
	output string,
) (*SyncTeXViewResult, error) {
	result := &SyncTeXViewResult{}

	for _, line := range strings.Split(
		output,
		"\n",
	) {
		key, value, ok := strings.Cut(
			strings.TrimSpace(line),
			":",
		)

		if !ok {
			continue
		}

		value = strings.TrimSpace(value)

		switch key {
		case "Page":
			parsed, err := strconv.Atoi(value)
			if err != nil {
				continue
			}

			result.Page = parsed

		case "x":
			result.X = parseFloat(value)

		case "y":
			result.Y = parseFloat(value)

		case "W":
			result.Width = parseFloat(value)

		case "H":
			result.Height = parseFloat(value)
		}
	}

	if result.Page <= 0 {
		return nil, fmt.Errorf(
			"synctex did not return a PDF position\n%s",
			output,
		)
	}

	return result, nil
}

func parseSyncTeXEdit(
	output string,
	projectDir string,
) (*SyncTeXEditResult, error) {
	result := &SyncTeXEditResult{}

	var inputFile string

	for _, line := range strings.Split(
		output,
		"\n",
	) {
		key, value, ok := strings.Cut(
			strings.TrimSpace(line),
			":",
		)

		if !ok {
			continue
		}

		value = strings.TrimSpace(value)

		switch key {
		case "Input":
			inputFile = value

		case "Line":
			result.Line = parseInt(value)

		case "Column":
			result.Column = parseInt(value)
		}
	}

	if inputFile == "" {
		return nil, fmt.Errorf(
			"synctex did not return a source file\n%s",
			output,
		)
	}

	if result.Line <= 0 {
		return nil, fmt.Errorf(
			"synctex did not return a source line\n%s",
			output,
		)
	}

	const containerPrefix = "/workdir/"

	if strings.HasPrefix(
		inputFile,
		containerPrefix,
	) {
		relative := strings.TrimPrefix(
			inputFile,
			containerPrefix,
		)

		inputFile = filepath.ToSlash(
			filepath.Clean(relative),
		)
	}

	result.File = inputFile

	return result, nil
}

func safeProjectPath(
	projectDir string,
	file string,
) (string, error) {
	file = filepath.Clean(
		filepath.FromSlash(file),
	)

	if filepath.IsAbs(file) ||
		file == "." ||
		file == ".." ||
		strings.HasPrefix(
			file,
			".."+string(os.PathSeparator),
		) {
		return "", fmt.Errorf(
			"invalid project file path",
		)
	}

	fullPath := filepath.Join(
		projectDir,
		file,
	)

	relative, err := filepath.Rel(
		projectDir,
		fullPath,
	)

	if err != nil {
		return "", fmt.Errorf(
			"invalid project file path",
		)
	}

	if relative == ".." ||
		strings.HasPrefix(
			relative,
			".."+string(os.PathSeparator),
		) {
		return "", fmt.Errorf(
			"invalid project file path",
		)
	}

	return fullPath, nil
}

func parseFloat(value string) float64 {
	result, _ := strconv.ParseFloat(
		value,
		64,
	)

	return result
}

func parseInt(value string) int {
	result, _ := strconv.Atoi(value)

	return result
}
