CREATE TABLE learning_attempts (
  id uuid PRIMARY KEY,
  artifact_id uuid NOT NULL,
  revision_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  correct integer NOT NULL CHECK (correct >= 0),
  total integer NOT NULL CHECK (total BETWEEN 1 AND 3 AND total >= correct),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (artifact_id,revision_id) REFERENCES artifact_revisions(artifact_id,id)
);
CREATE INDEX learning_attempt_lookup ON learning_attempts (artifact_id,user_id,revision_id,lesson_id,created_at DESC,id DESC);
