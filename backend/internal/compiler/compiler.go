package compiler

import (
	"context"
	"fmt"
	"os"
)

type Config struct {
	Image string
}

type Compiler struct {
	image string
}

func New(config Config) *Compiler {
	return &Compiler{
		image: config.Image,
	}
}

func (c *Compiler) Compile(
	ctx context.Context,
	buildDir string,
	engine string,
	mainFile string,
) (*Result, error) {
	if c.image == "" {
		return nil, fmt.Errorf("latex compiler image is not configured")
	}

	if mainFile == "" {
		return nil, fmt.Errorf("main file is not configured")
	}

	if _, err := os.Stat(mainFile); err != nil {
		return nil, fmt.Errorf("main file not found: %w", err)
	}

	return c.compileDocker(ctx, buildDir, engine, mainFile)
}
