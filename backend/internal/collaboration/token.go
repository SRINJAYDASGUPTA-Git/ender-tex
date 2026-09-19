package collaboration

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const tokenLifetime = time.Hour

type tokenService struct {
	secret []byte
}

type tokenClaims struct {
	UserID    string `json:"user_id"`
	ExpiresAt int64  `json:"expires_at"`
}

func newTokenService(secret string) (*tokenService, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, errors.New("collaboration token secret cannot be empty")
	}

	return &tokenService{
		secret: []byte(secret),
	}, nil
}

func (s *tokenService) Issue(userID string) (string, error) {
	claims := tokenClaims{
		UserID:    userID,
		ExpiresAt: time.Now().Add(tokenLifetime).Unix(),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)

	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(encodedPayload))

	signature := base64.RawURLEncoding.EncodeToString(
		mac.Sum(nil),
	)

	return encodedPayload + "." + signature, nil
}

func (s *tokenService) Verify(token string) (string, error) {
	parts := strings.Split(token, ".")

	if len(parts) != 2 {
		return "", errors.New("invalid collaboration token")
	}

	payloadPart := parts[0]
	signaturePart := parts[1]

	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(payloadPart))

	expectedSignature := mac.Sum(nil)

	actualSignature, err := base64.RawURLEncoding.DecodeString(
		signaturePart,
	)
	if err != nil {
		return "", errors.New("invalid collaboration token signature")
	}

	if !hmac.Equal(expectedSignature, actualSignature) {
		return "", errors.New("invalid collaboration token signature")
	}

	payload, err := base64.RawURLEncoding.DecodeString(
		payloadPart,
	)
	if err != nil {
		return "", errors.New("invalid collaboration token payload")
	}

	var claims tokenClaims

	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", errors.New("invalid collaboration token payload")
	}

	if claims.UserID == "" {
		return "", errors.New("collaboration token user is missing")
	}

	if time.Now().Unix() >= claims.ExpiresAt {
		return "", errors.New("collaboration token expired")
	}

	return claims.UserID, nil
}
