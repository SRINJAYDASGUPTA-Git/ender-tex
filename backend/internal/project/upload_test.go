package project

import (
	"errors"
	"testing"
)

func TestUpload_NormalizeUploadPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
		err   error
	}{
		{"valid.tex", "valid.tex", nil},
		{"folder/valid.tex", "folder/valid.tex", nil},
		{"  trim.tex  ", "trim.tex", nil},
		{"", "", ErrInvalidPath},
		{"bad\\win.tex", "", ErrInvalidPath},
		{".", "", ErrInvalidPath},
		{"..", "", ErrInvalidPath},
		{"../escape.tex", "", ErrInvalidPath},
		{"/absolute.tex", "", ErrInvalidPath},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := normalizeUploadPath(tt.input)
			if !errors.Is(err, tt.err) {
				t.Errorf("expected error %v, got %v", tt.err, err)
			}
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestUpload_FilepathDir(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"folder/file.tex", "folder"},
		{"file.tex", "."},
		{"a/b/c.tex", "a/b"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := filepathDir(tt.input)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}
