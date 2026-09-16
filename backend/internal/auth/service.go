package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"

	"paper-server/internal/email"
)

const (
	argonTime    = 3
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16

	sessionDuration = 7 * 24 * time.Hour

	invitationDuration = 48 * time.Hour
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type ProjectChecker interface {
	Exists(projectID string) (bool, error)
	GetName(projectID string) (string, error)
}
type InvitationAcceptance struct {
	User        *User
	Session     *Session
	SessionToken string
	ProjectID   string
}
type Service struct {
	repository  *Repository
	checker     ProjectChecker
	emailSender email.Service
	appURL      string
}

func NewService(
	repository *Repository,
	checker ProjectChecker,
	emailSender email.Service,
	appURL string,
) *Service {
	return &Service{
		repository:  repository,
		checker:     checker,
		emailSender: emailSender,
		appURL:      appURL,
	}
}
func (s *Service) CreateUser(
	email string,
	name string,
	password string,
	role Role,
) (*User, error) {

	email = strings.ToLower(strings.TrimSpace(email))

	if email == "" {
		return nil, errors.New("email is required")
	}

	if len(password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &User{
		ID:           uuid.NewString(),
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		Role:         role,
	}

	if err := s.repository.CreateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Service) Authenticate(
	email string,
	password string,
) (*User, error) {

	email = strings.ToLower(strings.TrimSpace(email))

	user, err := s.repository.GetUserByEmail(email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}

		return nil, err
	}

	if !verifyPassword(password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

func (s *Service) CreateSession(userID string) (
	*Session,
	string,
	error,
) {
	sessionID := uuid.NewString()

	token, err := generateToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate session token: %w", err)
	}

	tokenHash := hashToken(token)

	session := &Session{
		ID:        sessionID,
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(sessionDuration),
	}

	_, err = s.repository.db.Exec(`
		INSERT INTO sessions (
			id,
			user_id,
			token_hash,
			expires_at
		)
		VALUES (?, ?, ?, ?)
	`,
		session.ID,
		session.UserID,
		session.TokenHash,
		session.ExpiresAt,
	)

	if err != nil {
		return nil, "", fmt.Errorf("create session: %w", err)
	}

	return session, token, nil
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)

	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		argonTime,
		argonMemory,
		argonThreads,
		argonKeyLen,
	)

	return fmt.Sprintf(
		"$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory,
		argonTime,
		argonThreads,
		hex.EncodeToString(salt),
		hex.EncodeToString(hash),
	), nil
}

func verifyPassword(password, encodedHash string) bool {
	parts := strings.Split(encodedHash, "$")

	if len(parts) != 6 {
		return false
	}

	if parts[1] != "argon2id" || parts[2] != "v=19" {
		return false
	}

	var memory uint32
	var timeCost uint32
	var threads uint8

	_, err := fmt.Sscanf(
		parts[3],
		"m=%d,t=%d,p=%d",
		&memory,
		&timeCost,
		&threads,
	)
	if err != nil {
		return false
	}

	salt, err := hex.DecodeString(parts[4])
	if err != nil {
		return false
	}

	expectedHash, err := hex.DecodeString(parts[5])
	if err != nil {
		return false
	}

	actualHash := argon2.IDKey(
		[]byte(password),
		salt,
		timeCost,
		memory,
		threads,
		uint32(len(expectedHash)),
	)

	return subtleConstantTimeCompare(actualHash, expectedHash)
}

func subtleConstantTimeCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}

	var result byte

	for i := range a {
		result |= a[i] ^ b[i]
	}

	return result == 0
}

func generateToken() (string, error) {
	bytes := make([]byte, 32)

	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return hex.EncodeToString(bytes), nil
}

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func (s *Service) GetUserBySessionToken(token string) (*User, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}

	session, err := s.repository.GetSessionByTokenHash(hashToken(token))
	if err != nil {
		return nil, err
	}

	if time.Now().After(session.ExpiresAt) {
		_ = s.repository.DeleteSession(session.TokenHash)
		return nil, ErrSessionNotFound
	}

	return s.repository.GetUserByID(session.UserID)
}

func (s *Service) DeleteSession(token string) error {
	if token == "" {
		return nil
	}

	return s.repository.DeleteSession(hashToken(token))
}
func (s *Service) CreateAdmin(email, name, password string) (*User, error) {
	return s.CreateUser(email, name, password, RoleAdmin)
}

func (s *Service) CreateInvitation(email string, name string, role Role, projectID string) (*Invitation, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	if email == "" {
		return nil, "", errors.New("email is required")
	}

	if role != RoleCollaborator {
		return nil, "", errors.New("invalid invitation role")
	}

	if projectID == "" {
		return nil, "", errors.New("project_id is required")
	}

	exists, err := s.checker.Exists(projectID)
	if err != nil {
		return nil, "", fmt.Errorf("check project exists: %w", err)
	}
	if !exists {
		return nil, "", errors.New("project not found")
	}

	projectName, err := s.checker.GetName(projectID)
	if err != nil {
		return nil, "", fmt.Errorf("get project name: %w", err)
	}

		_, err = s.repository.GetUserByEmail(email)
	
	existingUser := false
	
	if err == nil {
    existingUser = true
	} else if !errors.Is(err, ErrUserNotFound) {
    return nil, "", err
	}

	token, err := generateToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate invitation token: %w", err)
	}

	expiration := time.Now().Add(invitationDuration)

	invitation := &Invitation{
		ID:        uuid.NewString(),
		Email:     email,
		Name:      name,
		Role:      role,
		ProjectID:    projectID,
		ExistingUser: existingUser,
		ExpiresAt: expiration,
	}

	if err := s.repository.CreateInvitation(
		invitation,
		hashToken(token),
	); err != nil {
		return nil, "", err
	}

	inviteURL := fmt.Sprintf(
		"%s/accept-invitation?token=%s",
		// we'll pass APP_URL into the service shortly
		strings.TrimRight(s.appURL, "/"),
		token,
	)

	if err := s.emailSender.SendInvitation(
		invitation.Email,
		invitation.Name,
		projectName,
		inviteURL,
		expiration,
	); err != nil {
		return nil, "", err
	}

	return invitation, token, nil
}

func (s *Service) AcceptInvitation(
	token string,
	password string,
) (*InvitationAcceptance, error) {
	if token == "" {
		return nil, ErrInvitationNotFound
	}

	if len(password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	invitation, err := s.repository.GetInvitationByTokenHash(hashToken(token))
	if err != nil {
		return nil, err
	}

	if time.Now().After(invitation.ExpiresAt) {
		_ = s.repository.DeleteInvitation(invitation.ID)
		return nil, errors.New("invitation has expired")
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, session, sessionToken, err := s.repository.AcceptInvitation(
		invitation,
		passwordHash,
	)
	if err != nil {
		return nil, err
	}

	return &InvitationAcceptance{
		User:        user,
		Session:     session,
		SessionToken: sessionToken,
		ProjectID:   invitation.ProjectID,
	}, nil
}

func (s *Service) GetInvitationDetails(
	token string,
) (*Invitation, error) {
	if token == "" {
		return nil, ErrInvitationNotFound
	}

	invitation, err := s.repository.GetInvitationByTokenHash(
		hashToken(token),
	)
	if err != nil {
		return nil, err
	}

	if time.Now().After(invitation.ExpiresAt) {
		_ = s.repository.DeleteInvitation(invitation.ID)
		return nil, errors.New("invitation has expired")
	}

	return invitation, nil
}
