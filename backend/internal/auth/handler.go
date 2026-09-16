// internal/auth/handler.go
package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

const sessionCookieName = "paper_server_session"

type Handler struct {
	service *Service
}

type createInvitationRequest struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	ProjectID string `json:"project_id"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type acceptInvitationRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type invitationDetailsResponse struct {
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	ExistingUser bool      `json:"existing_user"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// Login authenticates a user and creates a session.
//
//	@Summary		Login
//	@Description	Authenticates a user using email and password.
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		loginRequest	true	"Login credentials"
//	@Success		200		{object}	User
//	@Failure		400		{string}	string
//	@Failure		401		{string}	string
//	@Router			/auth/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.service.Authenticate(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			http.Error(w, "invalid email or password", http.StatusUnauthorized)
			return
		}

		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	_, token, err := h.service.CreateSession(user.ID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // HTTPS will be enabled in production.
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})

	writeJSON(w, http.StatusOK, user)
}

// Logout terminates the current user session.
//
//	@Summary		Logout
//	@Description	Invalidates the current session and clears the session cookie.
//	@Tags			Authentication
//	@Success		204
//	@Failure		405	{string}	string	"Method not allowed"
//	@Router			/auth/logout [post]
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie(sessionCookieName)
	if err == nil {
		_ = h.service.DeleteSession(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
	})

	w.WriteHeader(http.StatusNoContent)
}

// Me returns the currently authenticated user.
//
//	@Summary		Get current user
//	@Description	Returns the user associated with the current session.
//	@Tags			Authentication
//	@Produce		json
//	@Security		SessionCookie
//	@Success		200	{object}	User
//	@Failure		401	{string}	string	"Unauthorized"
//	@Failure		405	{string}	string	"Method not allowed"
//	@Router			/auth/me [get]
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.service.GetUserBySessionToken(cookie.Value)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// CreateInvitation creates an invitation for a new collaborator.
//
//	@Summary		Create invitation
//	@Description	Creates a collaborator invitation and returns the invitation token.
//	@Tags			Administration
//	@Accept			json
//	@Produce		json
//	@Param			request	body		createInvitationRequest	true	"Invitation details"
//	@Success		201		{object}	map[string]interface{}	"Created invitation"
//	@Failure		400		{string}	string					"Invalid request or invitation"
//	@Failure		405		{string}	string					"Method not allowed"
//	@Router			/admin/invitations [post]
func (h *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req createInvitationRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	invitation, token, err := h.service.CreateInvitation(
		req.Email,
		req.Name,
		RoleCollaborator,
		req.ProjectID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// For now we return the invitation token directly.
	// Later this will be sent through the chosen invitation mechanism.
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":         invitation.ID,
		"email":      invitation.Email,
		"name":       invitation.Name,
		"role":       invitation.Role,
		"expires_at": invitation.ExpiresAt,
		"token":      token,
	})
}

// AcceptInvitation accepts an invitation and creates a collaborator account.
//
//	@Summary		Accept invitation
//	@Description	Accepts a valid invitation token and creates the associated user account.
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		acceptInvitationRequest	true	"Invitation acceptance details"
//	@Success		201		{object}	User
//	@Failure		400		{string}	string	"Invalid invitation or request"
//	@Failure		405		{string}	string	"Method not allowed"
//	@Router			/auth/accept-invitation [post]
func (h *Handler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req acceptInvitationRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	acceptance, err := h.service.AcceptInvitation(
		req.Token,
		req.Password,
		
	)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvitationNotFound):
			http.Error(w, "invalid invitation", http.StatusBadRequest)

		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}

		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    acceptance.SessionToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // true in production HTTPS
		SameSite: http.SameSiteLaxMode,
		Expires:  acceptance.Session.ExpiresAt,
	})

	writeJSON(w, http.StatusCreated, map[string]any{
		"user":       acceptance.User,
		"project_id": acceptance.ProjectID,
	})
}

// GetInvitationDetails returns the details of a valid invitation token.
//
//	@Router			/auth/invitation-details [get]
//	@Summary		Get invitation details
//	@Description	Returns the details of a valid invitation token.
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			token	query		string	true	"Invitation token"
//	@Success		200		{object}	invitationDetailsResponse
//	@Failure		400		{string}	string	"Invalid invitation or request"
//	@Failure		404		{string}	string	"Invitation not found"
//	@Failure		410		{string}	string	"Invitation has expired"
//	@Failure		500		{string}	string	"Internal server error"
//	@Router			/auth/invitation [get]
func (h *Handler) GetInvitationDetails(
	w http.ResponseWriter,
	r *http.Request,
) {
	token := r.URL.Query().Get("token")

	invitation, err := h.service.GetInvitationDetails(token)
	if err != nil {
		if errors.Is(err, ErrInvitationNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "invitation not found",
			})
			return
		}

		if err.Error() == "invitation has expired" {
			writeJSON(w, http.StatusGone, map[string]string{
				"error": "invitation has expired",
			})
			return
		}

		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to get invitation",
		})
		return
	}

	writeJSON(w, http.StatusOK, invitationDetailsResponse{
		Email:     invitation.Email,
		Name:      invitation.Name,
		ExistingUser: invitation.ExistingUser,
		ExpiresAt: invitation.ExpiresAt,
	})
}
