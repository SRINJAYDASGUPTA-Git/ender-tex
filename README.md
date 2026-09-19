# EnderTeX

EnderTeX is a self-hosted, collaborative LaTeX editor designed for writing, compiling, and managing LaTeX projects from a single workspace.

It combines a browser-based LaTeX editor with real-time collaboration, project management, server-side compilation, PDF preview, authentication, and file management.

## Features

* Self-hosted LaTeX workspace
* Real-time collaborative editing
* Monaco-based LaTeX editor
* Yjs-based collaboration
* Go backend with WebSocket collaboration support
* Server-side LaTeX compilation using Docker
* PDF preview directly inside the editor
* PDF text search with visual highlighting
* Project and file management
* Recursive file and folder uploads
* Project-specific compilation configuration
* BibTeX and Biber support
* User authentication with secure password hashing
* HTTP-only session authentication
* Project-based permissions and collaborators
* Project invitations through email
* Responsive dashboard and project management interface
* Swagger/OpenAPI API documentation
* Self-hosted storage

## Architecture

EnderTeX is split into a Next.js frontend and a Go backend.

```text
                         EnderTeX
                            |
              +-------------+-------------+
              |                           |
          Frontend                     Backend
         Next.js                        Go
              |                           |
      +-------+--------+          +-------+--------+
      |                |          |       |        |
    Monaco           PDF.js     Auth   Projects  Compiler
      |                |          |       |        |
     Yjs          PDF Search    SQLite  Files    Docker
      |                |
      +-------- WebSocket --------+
```

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Monaco Editor
* Yjs
* y-monaco
* y-websocket
* React PDF
* Axios

### Backend

* Go
* SQLite
* Ygo
* WebSockets
* Argon2id
* SMTP
* Swagger/OpenAPI

### Compilation

LaTeX compilation is performed server-side using Docker-based compiler environments.

Supported compilation engines depend on the project configuration and installed compiler environment.

## Project Structure

```text
ender-tex/
├── backend/
│   ├── cmd/
│   │   └── server/
│   ├── internal/
│   │   ├── auth/
│   │   ├── compiler/
│   │   ├── config/
│   │   ├── database/
│   │   ├── email/
│   │   └── project/
│   ├── data/
│   ├── go.mod
│   └── go.sum
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── providers/
│   ├── types/
│   ├── utils/
│   ├── package.json
│   └── ...
│
└── README.md
```

## Requirements

Before running EnderTeX locally, install:

* Go 1.27+
* Node.js
* npm
* Docker
* A LaTeX compiler Docker environment
* SQLite

## Running the Backend

Navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
go mod download
```

Run the server:

```bash
go run ./cmd/server
```

The backend runs on:

```text
http://localhost:8080
```

The exact port and other settings can be configured through the application's environment configuration.

## Running the Frontend

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend is then available at:

```text
http://localhost:3000
```

## Authentication

EnderTeX uses server-side sessions rather than storing authentication tokens in browser-accessible storage.

The authentication flow is:

```text
User
  |
  | email + password
  v
Go Authentication API
  |
  | Argon2id password verification
  v
Session creation
  |
  | random session token
  v
HTTP-only session cookie
  |
  v
Browser
```

The session cookie is:

```text
paper_server_session
```

The cookie is HTTP-only and uses `SameSite=Lax`.

Session tokens are hashed before being stored in the database.

In production, the session cookie should be served with the `Secure` flag over HTTPS.

## Collaboration

Real-time collaboration is implemented using Yjs.

Each collaborative document is associated with a project and file path.

```text
Project
   |
   +-- main.tex
   |      |
   |      +-- Yjs document
   |
   +-- sections/
          |
          +-- introduction.tex
                 |
                 +-- Yjs document
```

The Go backend acts as the WebSocket server for collaborative sessions.

Monaco is connected to Yjs through `y-monaco`.

Collaborator presence and cursor information are also synchronized through Yjs awareness.

## Project Storage

Projects are stored on the server filesystem.

The general structure is:

```text
projects/
└── <project-id>/
    ├── main.tex
    ├── sections/
    │   ├── introduction.tex
    │   └── results.tex
    ├── figures/
    │   └── figure.png
    ├── references.bib
    └── ...
```

Project files are managed through the backend API.

Uploads support both individual files and folder structures.

The backend validates uploaded paths and applies file-size limits to prevent unsafe filesystem access and excessively large requests.

## PDF Compilation

When a project is compiled:

```text
Project files
      |
      v
Compilation configuration
      |
      v
Docker LaTeX environment
      |
      v
LaTeX compiler
      |
      v
PDF
      |
      v
PDF.js
```

The generated PDF is displayed directly inside the project editor.

EnderTeX does not need to permanently store every compiled PDF. Compilation output can instead be treated as generated project state.

## PDF Search

The PDF viewer provides client-side text search using the PDF.js text layer.

Search results are highlighted using an overlay rather than modifying the PDF.js text layer itself.

This keeps the text-layer geometry intact while allowing precise visual highlighting.

Supported search interactions include:

* Search query
* Match count
* Previous match
* Next match
* Enter to move to the next match
* Shift+Enter to move to the previous match
* Escape to close the search interface
* Automatic scrolling to the selected match

## Planned SyncTeX Integration

EnderTeX is planned to support bidirectional SyncTeX navigation.

```text
Monaco Editor
     |
     | Source -> PDF
     v
  SyncTeX
     |
     v
PDF.js


PDF.js
     |
     | PDF -> Source
     v
  SyncTeX
     |
     v
Monaco Editor
```

This will allow:

* Jumping from a source line to the corresponding PDF location
* Double-clicking a PDF location to jump to the corresponding source
* Automatic PDF navigation from Monaco
* Automatic Monaco navigation from the PDF

Compilation will generate SyncTeX metadata using the LaTeX compiler's SyncTeX support.

## Email

EnderTeX supports SMTP-based email delivery for project invitations.

Invitation flow:

```text
Project owner
      |
      v
Create invitation
      |
      v
Generate invitation token
      |
      v
Store invitation
      |
      v
Send invitation email
      |
      v
Recipient
      |
      v
Accept invitation
```

SMTP configuration is supplied through environment variables.

## API

The backend exposes a REST API under:

```text
/api
```

Authentication, project management, file management, collaboration, compilation, and invitation functionality are exposed through the API.

Swagger documentation is generated for the backend API.

The API documentation describes the project as:

```text
EnderTex API

REST API for EnderTex, a collaborative LaTeX project server.
```

## Security

Current security-related measures include:

* Argon2id password hashing
* Random session tokens
* SHA-256 hashing of stored session tokens
* HTTP-only authentication cookies
* SameSite cookie protection
* Server-side session validation
* Project-level authorization
* File path validation
* Upload size limits
* Upload rollback on failure
* Docker-based compilation isolation

For production deployments:

* Use HTTPS
* Enable the `Secure` attribute on session cookies
* Use strong SMTP credentials
* Protect environment configuration
* Restrict access to the backend
* Keep Docker and LaTeX images updated
* Use appropriate firewall rules
* Back up the project database and project storage

## Cookie Policy

EnderTeX uses a first-party session cookie for authentication.

```text
paper_server_session
```

The cookie is required to maintain an authenticated session and access protected functionality.

It is not intended for advertising or behavioural tracking.

Because the authentication cookie is required for the service to function, EnderTeX does not require a cookie-consent banner solely for this session cookie.

A dedicated Cookie Policy should still explain the cookie's purpose, duration, and security characteristics.

## Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
go mod download
go run ./cmd/server
```

For production deployments, build the frontend and backend using the appropriate deployment environment and serve the application over HTTPS.

## Roadmap

Planned improvements include:

* Bidirectional SyncTeX navigation
* Improved project activity history
* More detailed collaboration presence
* Project sharing improvements
* Additional LaTeX compiler configurations
* Improved compilation diagnostics
* Better PDF/source synchronization
* Expanded project dashboard
* Production deployment tooling

## License

EnderTeX is licensed under the PolyForm Noncommercial License 1.0.0.

You may use, modify, and distribute EnderTeX for non-commercial purposes,
subject to the terms of the license.

See the [LICENSE](LICENSE) file for the full license text.

## Status

EnderTeX is currently under active development.

Core functionality including authentication, project management, file management, collaborative editing, compilation, and PDF preview is being developed incrementally.
