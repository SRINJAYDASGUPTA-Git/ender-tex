package project

import (
	"testing"
)

func TestHandler_PathExtractors(t *testing.T) {
	t.Run("projectIDFromPath", func(t *testing.T) {
		// projectIDFromPath expects a sub-route (e.g., /members) to calculate length correctly
		id, ok := projectIDFromPath("/api/projects/proj-1/members")
		if !ok || id != "proj-1" {
			t.Error("failed to extract project ID")
		}

		_, ok = projectIDFromPath("/api/projects/")
		if ok {
			t.Error("should fail on empty ID")
		}

		_, ok = projectIDFromPath("/wrong/proj-1/members")
		if ok {
			t.Error("should fail on wrong prefix")
		}
	})

	t.Run("projectFileFromPath", func(t *testing.T) {
		id, file, ok := projectFileFromPath("/api/projects/proj-1/files/main.tex")
		if !ok || id != "proj-1" || file != "files/main.tex" {
			t.Error("failed to extract project ID and file")
		}

		_, _, ok = projectFileFromPath("/api/projects/proj-1")
		if ok {
			t.Error("should fail when file part is missing")
		}
	})

	t.Run("projectDirectoryFromPath", func(t *testing.T) {
		id, dir, ok := projectDirectoryFromPath("/api/projects/proj-1/folders/img")
		if !ok || id != "proj-1" || dir != "folders/img" {
			t.Error("failed to extract project ID and directory")
		}
	})
}
