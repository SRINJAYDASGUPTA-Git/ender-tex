package project

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

type CompileStatus string

const (
	CompileStatusQueued    CompileStatus = "queued"
	CompileStatusRunning   CompileStatus = "running"
	CompileStatusSucceeded CompileStatus = "succeeded"
	CompileStatusFailed    CompileStatus = "failed"
)

var ErrCompileAlreadyRunning = errors.New("compilation already running")

type CompileJob struct {
	ID           string        `json:"jobId"`
	ProjectID    string        `json:"projectId"`
	Status       CompileStatus `json:"status"`
	Success      bool          `json:"success"`
	Log          string        `json:"log,omitempty"`
	PDFAvailable bool          `json:"pdfAvailable"`
	Error        string        `json:"error,omitempty"`
	StartedAt    *time.Time    `json:"startedAt,omitempty"`
	FinishedAt   *time.Time    `json:"finishedAt,omitempty"`
}

type CompileJobManager struct {
	mu      sync.RWMutex
	jobs    map[string]*CompileJob
	running map[string]string
	ttl     time.Duration
}

func NewCompileJobManager() *CompileJobManager {
	return &CompileJobManager{
		jobs:    make(map[string]*CompileJob),
		running: make(map[string]string),
		ttl:     15 * time.Minute,
	}
}

func (m *CompileJobManager) Start(projectID string) (*CompileJob, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.pruneLocked(time.Now())

	if _, ok := m.running[projectID]; ok {
		return nil, ErrCompileAlreadyRunning
	}

	job := &CompileJob{
		ID:        uuid.NewString(),
		ProjectID: projectID,
		Status:    CompileStatusQueued,
	}

	m.jobs[job.ID] = job
	m.running[projectID] = job.ID

	return job, nil
}

func (m *CompileJobManager) MarkRunning(jobID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[jobID]
	if !ok {
		return
	}

	now := time.Now()
	job.Status = CompileStatusRunning
	job.StartedAt = &now
}

func (m *CompileJobManager) Succeed(
	jobID string,
	log string,
	pdfAvailable bool,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[jobID]
	if !ok {
		return
	}

	now := time.Now()
	job.Status = CompileStatusSucceeded
	job.Success = true
	job.Log = log
	job.PDFAvailable = pdfAvailable
	job.FinishedAt = &now
	delete(m.running, job.ProjectID)
}

func (m *CompileJobManager) Fail(
	jobID string,
	log string,
	err error,
	pdfAvailable bool,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[jobID]
	if !ok {
		return
	}

	now := time.Now()
	job.Status = CompileStatusFailed
	job.Success = false
	job.Log = log
	job.PDFAvailable = pdfAvailable
	job.FinishedAt = &now

	if err != nil {
		job.Error = err.Error()
	}

	delete(m.running, job.ProjectID)
}

func (m *CompileJobManager) Get(jobID string) (*CompileJob, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.pruneLocked(time.Now())

	job, ok := m.jobs[jobID]
	return job, ok
}

func (m *CompileJobManager) pruneLocked(now time.Time) {
	for id, job := range m.jobs {
		if job.FinishedAt == nil {
			continue
		}

		if now.Sub(*job.FinishedAt) > m.ttl {
			delete(m.jobs, id)
		}
	}
}

func (h *Handler) runCompileJob(
	jobID string,
	projectID string,
	engine string,
	mainFile string,
) {
	h.compileJobs.MarkRunning(jobID)

	ctx, cancel := context.WithTimeout(
		context.Background(),
		15*time.Minute,
	)
	defer cancel()

	projectDir := h.storage.ProjectPath(projectID)

	result, err := h.compiler.Compile(
		ctx,
		projectDir,
		engine,
		mainFile,
	)
	if err != nil {
		h.compileJobs.Fail(jobID, "", err, false)
		return
	}

	if !result.Success {
		h.compileJobs.Fail(
			jobID,
			result.Log,
			nil,
			result.PDFAvailable,
		)
		return
	}

	currentPDF := filepath.Join(
		projectDir,
		"current.pdf",
	)

	if filepath.Clean(result.PDFPath) != filepath.Clean(currentPDF) {
		if err := copyFile(result.PDFPath, currentPDF); err != nil {
			h.compileJobs.Fail(jobID, result.Log, err, result.PDFAvailable)
			return
		}
	}

	h.compileJobs.Succeed(
		jobID,
		result.Log,
		result.PDFAvailable,
	)
}
