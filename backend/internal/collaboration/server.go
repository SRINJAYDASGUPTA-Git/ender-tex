package collaboration

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	ycrdt "github.com/reearth/ygo/crdt"
	yws "github.com/reearth/ygo/provider/websocket"

	"paper-server/internal/auth"
	"paper-server/internal/project"
)

type Server struct {
	ygo      *yws.Server
	tokens   *tokenService
	projects *project.Service
	storage  *project.Storage
}

func NewServer(
	appURL string,
	tokenSecret string,
	projects *project.Service,
	storage *project.Storage,
) (*Server, error) {
	tokens, err := newTokenService(tokenSecret)
	if err != nil {
		return nil, err
	}

	server := &Server{
		tokens:   tokens,
		projects: projects,
		storage:  storage,
	}

	ygoServer := yws.NewServer()

	// Browser WebSocket connections originate from the Next.js app.
	// Append the local development origin to the slice.
	fmt.Println("appURL:", appURL)
	ygoServer.AllowedOrigins = []string{
		appURL,
		"http://localhost:3000",
		"http://192.168.0.152:3000",
		"http://ender-tex-frontend:3000",
		"https://ender-tex.srinjaydg.in",
	}

	ygoServer.MaxPeersPerRoom = 20
	ygoServer.MaxConnections = 200
	ygoServer.AwarenessExpiry = 30_000_000_000 // 30 seconds

	ygoServer.Authorize = server.authorize
	ygoServer.OnLoadDocument = server.loadDocument

	server.ygo = ygoServer

	return server, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	room := r.PathValue("room")

	log.Printf(
		"[YJS] incoming request method=%s remote=%s path=%s room=%q origin=%q query=%q",
		r.Method,
		r.RemoteAddr,
		r.URL.Path,
		room,
		r.Header.Get("Origin"),
		r.URL.RawQuery,
	)

	s.ygo.ServeHTTP(w, r)

	log.Printf(
		"[YJS] ygo ServeHTTP returned room=%q",
		room,
	)
}

func (s *Server) Token(
	w http.ResponseWriter,
	r *http.Request,
) {
	log.Printf(
		"[YJS] token request remote=%s path=%s",
		r.RemoteAddr,
		r.URL.Path,
	)

	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())

	if !ok {
		log.Printf(
			"[YJS] token request unauthorized",
		)

		http.Error(
			w,
			"unauthorized",
			http.StatusUnauthorized,
		)

		return
	}

	log.Printf(
		"[YJS] issuing collaboration token user=%s",
		userID,
	)

	token, err := s.tokens.Issue(userID)

	if err != nil {
		log.Printf(
			"[YJS] failed issuing token user=%s err=%v",
			userID,
			err,
		)

		http.Error(
			w,
			"failed to issue collaboration token",
			http.StatusInternalServerError,
		)

		return
	}

	log.Printf(
		"[YJS] collaboration token issued user=%s",
		userID,
	)

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	_ = json.NewEncoder(w).Encode(
		map[string]string{
			"token": token,
		},
	)
}

func (s *Server) authorize(
	r *http.Request,
) (yws.ConnectionConfig, bool) {

	log.Printf(
		"[YJS] authorize start remote=%s room=%q origin=%q",
		r.RemoteAddr,
		r.PathValue("room"),
		r.Header.Get("Origin"),
	)

	token := r.URL.Query().Get("token")

	log.Printf(
		"[YJS] token present=%t length=%d",
		token != "",
		len(token),
	)

	if token == "" {
		log.Printf(
			"[YJS] authorization rejected: missing token",
		)

		return yws.ConnectionConfig{}, false
	}

	userID, err := s.tokens.Verify(token)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: invalid token: %v",
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	log.Printf(
		"[YJS] token verified userID=%s",
		userID,
	)

	room := r.PathValue("room")

	projectID, filePath, err := decodeRoom(room)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: decodeRoom failed room=%q err=%v",
			room,
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	log.Printf(
		"[YJS] decoded room project=%s file=%s",
		projectID,
		filePath,
	)

	_, err = s.projects.GetForUser(
		projectID,
		userID,
	)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: user=%s cannot access project=%s err=%v",
			userID,
			projectID,
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	log.Printf(
		"[YJS] project access granted user=%s project=%s",
		userID,
		projectID,
	)

	canEdit, err := s.projects.CanEdit(
		projectID,
		userID,
	)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: CanEdit failed user=%s project=%s err=%v",
			userID,
			projectID,
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	log.Printf(
		"[YJS] permission user=%s project=%s canEdit=%t",
		userID,
		projectID,
		canEdit,
	)

	fullPath, err := s.storage.FilePath(
		projectID,
		filePath,
	)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: invalid file path project=%s file=%s err=%v",
			projectID,
			filePath,
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	info, err := os.Stat(fullPath)

	if err != nil {
		log.Printf(
			"[YJS] authorization rejected: file does not exist path=%s err=%v",
			fullPath,
			err,
		)

		return yws.ConnectionConfig{}, false
	}

	if info.IsDir() {
		log.Printf(
			"[YJS] authorization rejected: target is directory path=%s",
			fullPath,
		)

		return yws.ConnectionConfig{}, false
	}

	log.Printf(
		"[YJS] authorization SUCCESS user=%s project=%s file=%s readOnly=%t",
		userID,
		projectID,
		filePath,
		!canEdit,
	)

	return yws.ConnectionConfig{
		ReadOnly: !canEdit,
	}, true
}

func (s *Server) loadDocument(
	_ context.Context,
	room string,
	doc *ycrdt.Doc,
) error {

	log.Printf(
		"[YJS] loadDocument start room=%q",
		room,
	)

	projectID, filePath, err := decodeRoom(room)

	if err != nil {
		log.Printf(
			"[YJS] loadDocument decode failed room=%q err=%v",
			room,
			err,
		)

		return err
	}

	log.Printf(
		"[YJS] loading project=%s file=%s",
		projectID,
		filePath,
	)

	content, err := s.storage.ReadFile(
		projectID,
		filePath,
	)

	if err != nil {
		log.Printf(
			"[YJS] loadDocument ReadFile failed project=%s file=%s err=%v",
			projectID,
			filePath,
			err,
		)

		return fmt.Errorf(
			"load collaborative file: %w",
			err,
		)
	}

	log.Printf(
		"[YJS] filesystem content loaded bytes=%d project=%s file=%s",
		len(content),
		projectID,
		filePath,
	)

	text := doc.GetText("content")

	log.Printf(
		"[YJS] existing Yjs text length=%d",
		text.Len(),
	)

	if text.Len() == 0 && len(content) > 0 {
		doc.Transact(func(txn *ycrdt.Transaction) {
			text.Insert(
				txn,
				0,
				string(content),
				nil,
			)
		})

		log.Printf(
			"[YJS] seeded Yjs document with %d bytes",
			len(content),
		)
	} else {
		log.Printf(
			"[YJS] did not seed document existingText=%d filesystemBytes=%d",
			text.Len(),
			len(content),
		)
	}

	log.Printf(
		"[YJS] loadDocument complete project=%s file=%s textLength=%d",
		projectID,
		filePath,
		text.Len(),
	)

	return nil
}

func encodeRoom(
	projectID string,
	filePath string,
) string {
	raw := projectID + "\x00" + filePath

	return base64.RawURLEncoding.EncodeToString(
		[]byte(raw),
	)
}

func decodeRoom(
	room string,
) (string, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(room)

	if err != nil {
		return "", "", errors.New(
			"invalid collaboration room",
		)
	}

	parts := strings.SplitN(
		string(raw),
		"\x00",
		2,
	)

	if len(parts) != 2 ||
		parts[0] == "" ||
		parts[1] == "" {
		return "", "", errors.New(
			"invalid collaboration room",
		)
	}

	return parts[0], parts[1], nil
}
