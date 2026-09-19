// Package main EnderTex API.
//
//	@title						EnderTex API
//	@version					1.0
//	@description				REST API for EnderTex, a collaborative LaTeX project server.
//	@description				Provides authentication, project management, file management, and LaTeX compilation.
//	@BasePath					/api
//	@schemes					http https
//
//	@securitydefinitions.apikey	SessionCookie
//	@in							cookie
//	@name						paper_server_session
//	@description				HTTP-only session cookie used to authenticate requests.
package main

import (
	"bufio"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	httpSwagger "github.com/swaggo/http-swagger/v2"

	"golang.org/x/term"

	"github.com/joho/godotenv"

	"paper-server/internal/auth"
	"paper-server/internal/collaboration"
	"paper-server/internal/compiler"
	"paper-server/internal/config"
	"paper-server/internal/database"
	"paper-server/internal/email"
	"paper-server/internal/project"

	"path/filepath"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()

	db, err := database.Open()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(db); err != nil {
		log.Fatalf("migration: %v", err)
	}
	projectRepository := project.NewRepository(db)

	emailService, err := email.NewSMTPService(
		cfg.SMTPHost,
		cfg.SMTPPort,
		cfg.SMTPUsername,
		cfg.SMTPPassword,
		cfg.SMTPFrom,
	)
	if err != nil {
		log.Fatal(err)
	}

	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository, projectRepository, emailService, cfg.AppURL)

	if len(os.Args) > 1 && os.Args[1] == "--create-admin" {
		if err := createAdmin(authService); err != nil {
			log.Fatalf("create admin: %v", err)
		}
		return
	}

	authHandler := auth.NewHandler(authService)

	mux := http.NewServeMux()

	swaggerSpec, err := os.ReadFile(filepath.Join("docs", "swagger.json"))
	if err != nil {
		log.Fatalf("swagger spec: %v", err)
	}

	mux.HandleFunc("/swagger/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(swaggerSpec)
	})

	mux.Handle(
		"/swagger/",
		httpSwagger.Handler(
			httpSwagger.URL("/swagger/openapi.json"),
		),
	)

	auth.RegisterRoutes(mux, authHandler)

	projectStorage, err := project.NewStorage(
		filepath.Join(cfg.DataDir, "projects"),
	)
	if err != nil {
		log.Fatalf("project storage: %v", err)
	}

	projectService := project.NewService(
		projectRepository,
		projectStorage,
	)

	latexCompiler := compiler.New(
		compiler.Config{
			Image: "texlive/texlive:latest",
		},
	)

	compilerService := compiler.NewService(
		latexCompiler,
	)

	projectHandler := project.NewHandler(projectService, projectStorage, compilerService)

	collaborationServer, err := collaboration.NewServer(
		cfg.AppURL,
		cfg.CollabTokenSecret,
		projectService,
		projectStorage,
	)

	if err != nil {
		log.Fatalf(
			"collaboration server: %v",
			err,
		)
	}

	project.RegisterRoutes(
		mux,
		projectHandler,
		authHandler,
	)
	project.RegisterUploadRoute(
		mux,
		projectHandler,
		authHandler,
	)

	collaboration.RegisterRoutes(
		mux,
		collaborationServer,
		authHandler,
	)

	mux.HandleFunc("/api/health", health)

	addr := cfg.Host + ":" + cfg.Port

	log.Printf("Paper Server backend listening on %s", addr)
	log.Printf("Swagger UI available at http://%s/swagger/", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// health returns the status of the API server.
//
//	@Summary		Health check
//	@Description	Returns the current API server health status.
//	@Tags			System
//	@Produce		json
//	@Success		200	{object}	map[string]string
//	@Router			/health [get]
func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"status":"ok"}`)
}

func createAdmin(service *auth.Service) error {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Admin email: ")
	email, err := reader.ReadString('\n')
	if err != nil {
		return err
	}

	email = strings.TrimSpace(email)

	fmt.Print("Name: ")
	name, err := reader.ReadString('\n')
	if err != nil {
		return err
	}
	name = strings.TrimSpace(name)

	fmt.Print("Password: ")
	passwordBytes, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()

	if err != nil {
		return err
	}

	fmt.Print("Confirm password: ")
	confirmBytes, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()

	if err != nil {
		return err
	}

	password := string(passwordBytes)
	confirm := string(confirmBytes)

	if password != confirm {
		return errors.New("passwords do not match")
	}

	user, err := service.CreateAdmin(email, name, password)
	if err != nil {
		return err
	}

	fmt.Printf("Admin account created successfully: %s (%s)\n", user.Email, user.ID)

	return nil
}
