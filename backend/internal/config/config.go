package config

import "os"

type Config struct {
	Host       string
	Port       string
	DataDir    string
	LatexImage string

	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	AppURL string

	CollabTokenSecret string
}

func Load() Config {
	host := os.Getenv("PAPER_SERVER_HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	port := os.Getenv("PAPER_SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	dataDir := os.Getenv("PAPER_SERVER_DATA_DIR")

	if dataDir == "" {
		dataDir = "./data"
	}

	latexImage := os.Getenv("LATEX_IMAGE")

	if latexImage == "" {
		latexImage = "texlive/texlive"
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	collabTokenSecret := os.Getenv("COLLAB_TOKEN_SECRET")
	
	if collabTokenSecret == "" {
    	collabTokenSecret = "development-only-change-this-secret"
	}

	return Config{
		Host:       host,
		Port:       port,
		DataDir:    dataDir,
		LatexImage: latexImage,

		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     os.Getenv("SMTP_PORT"),
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:     os.Getenv("SMTP_FROM"),

		AppURL:            appURL,
		CollabTokenSecret: collabTokenSecret,
	}
}
