package compiler

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func (c *Compiler) compileDocker(
	ctx context.Context,
	buildDir string,
	engine string,
	mainFile string,
) (*Result, error) {
	args := []string{
		"run",
		"--rm",

		// Resource limits — we'll tune these later.
		"--memory=1g",
		"--cpus=2",

		// Mount the disposable build directory.
		"-v",
		fmt.Sprintf("%s:/workdir", buildDir),

		// Work inside the mounted directory.
		"-w",
		"/workdir",

		c.image,

		"latexmk",
	}

	switch engine {
	case "pdflatex":
		args = append(args, "-pdf")

	case "xelatex":
		args = append(args, "-xelatex")

	case "lualatex":
		args = append(args, "-lualatex")

	case "latex":
		args = append(args, "-pdf")

	default:
		return nil, fmt.Errorf("unsupported LaTeX engine: %s", engine)
	}

	args = append(
		args,
		"-interaction=nonstopmode",
		"-halt-on-error",
		mainFile,
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	cmd := exec.CommandContext(
		ctx,
		"docker",
		args...,
	)

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	log := stdout.String() + stderr.String()

	pdfPath := filepath.Join(
		buildDir,
		pdfName(mainFile),
	)

	if err != nil {
		return &Result{
			Success:      false,
			Log:          log,
			PDFAvailable: fileExists(pdfPath),
		}, nil
	}

	return &Result{
		Success:      true,
		Log:          log,
		PDFAvailable: fileExists(pdfPath),
	}, nil
}

func pdfName(mainFile string) string {
	name := filepath.Base(mainFile)

	if len(name) > 4 && name[len(name)-4:] == ".tex" {
		name = name[:len(name)-4]
	}

	return name + ".pdf"
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
