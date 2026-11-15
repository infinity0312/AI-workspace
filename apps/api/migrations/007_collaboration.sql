ALTER TABLE claim_reviews ADD COLUMN original_actor_id text;
ALTER TABLE workspace_memberships ADD COLUMN version int NOT NULL DEFAULT 1;
CREATE TABLE artifact_comments (
  id uuid PRIMARY KEY,
  artifact_id uuid NOT NULL REFERENCES artifacts(id),
  revision_id uuid NOT NULL,
  block_id uuid,
  author_id text NOT NULL REFERENCES users(id),
  original_author_id text,
  body text NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text REFERENCES users(id),
  FOREIGN KEY (artifact_id,revision_id) REFERENCES artifact_revisions(artifact_id,id)
);
CREATE INDEX artifact_comments_revision_idx ON artifact_comments(artifact_id,created_at DESC);
