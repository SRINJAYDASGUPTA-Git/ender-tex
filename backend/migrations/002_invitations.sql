CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'COLLABORATOR',
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_token_hash
    ON invitations(token_hash);

CREATE INDEX idx_invitations_email
    ON invitations(email);

CREATE INDEX idx_invitations_expires_at
    ON invitations(expires_at);