package config

import "os"

type Config struct {
	Host string
	Port string
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

	return Config{
		Host: host,
		Port: port,
	}
}
