CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    main_file TEXT NOT NULL DEFAULT 'main.tex',
    engine TEXT NOT NULL DEFAULT 'pdflatex',
    bibliography TEXT NOT NULL DEFAULT 'biber',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,

    CHECK (engine IN (
        'pdflatex',
        'latex',
        'xelatex',
        'lualatex'
    )),

    CHECK (bibliography IN (
        'biber',
        'bibtex'
    ))
);

CREATE INDEX idx_projects_owner_id
ON projects(owner_id);

CREATE INDEX idx_projects_updated_at
ON projects(updated_at);

CREATE TABLE project_memberships (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'EDITOR',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE(project_id, user_id),

    CHECK (permission IN (
        'VIEWER',
        'EDITOR'
    ))  
);

CREATE INDEX idx_project_memberships_project_id
ON project_memberships(project_id);

CREATE INDEX idx_project_memberships_user_id
ON project_memberships(user_id);