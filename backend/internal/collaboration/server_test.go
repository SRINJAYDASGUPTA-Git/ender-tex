package collaboration

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEncodeDecodeRoom_Success(t *testing.T) {
	projectID := "proj-uuid-456"
	filePath := "chapters/intro.tex"

	encoded := encodeRoom(projectID, filePath)
	assert.NotEmpty(t, encoded)

	decProjectID, decFilePath, err := decodeRoom(encoded)
	assert.NoError(t, err)
	assert.Equal(t, projectID, decProjectID)
	assert.Equal(t, filePath, decFilePath)
}

func TestDecodeRoom_Failures(t *testing.T) {
	t.Run("Invalid Base64", func(t *testing.T) {
		_, _, err := decodeRoom("not-base-64-@#$")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration room")
	})

	t.Run("Missing Null Delimiter", func(t *testing.T) {
		// Encode a string without the \x00 separator
		invalidRaw := "projectID_filePath_no_separator"
		invalidEncoded := base64.RawURLEncoding.EncodeToString([]byte(invalidRaw))

		_, _, err := decodeRoom(invalidEncoded)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration room")
	})

	t.Run("Empty Parts", func(t *testing.T) {
		// Encode a string with just the delimiter
		invalidRaw := "\x00"
		invalidEncoded := base64.RawURLEncoding.EncodeToString([]byte(invalidRaw))

		_, _, err := decodeRoom(invalidEncoded)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid collaboration room")
	})
}
