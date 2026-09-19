ALTER TABLE invitations
ADD COLUMN project_id TEXT
REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_invitations_project_id
ON invitations(project_id);