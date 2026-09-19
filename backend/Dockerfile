# Stage 1: Build the Go binary
FROM golang:1.27-alpine AS builder

WORKDIR /app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build
COPY . .
# CGO_ENABLED=0 ensures a static binary, since modernc.org/sqlite is pure Go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o ender-tex-backend ./cmd/server

# Stage 2: Create the minimal runtime image
FROM alpine:latest

# Install Docker CLI so the Go app can trigger LaTeX builds on the host
RUN apk add --no-cache docker-cli tzdata

WORKDIR /app

# Copy the static binary from the builder stage
COPY --from=builder /app/ender-tex-backend .

# Create a persistent directory for the SQLite database and project files
RUN mkdir -p /app/data

EXPOSE 8080

ENTRYPOINT ["./ender-tex-backend"]