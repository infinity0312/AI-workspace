CREATE TABLE study_goals (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, user_id text NOT NULL REFERENCES users,
  title text NOT NULL, notes text NOT NULL, target_date date, artifact_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES artifacts(workspace_id,id)
);
CREATE INDEX study_goals_owner ON study_goals(workspace_id,user_id,created_at DESC);
CREATE TABLE study_steps (
  id uuid PRIMARY KEY, goal_id uuid NOT NULL REFERENCES study_goals,
  title text NOT NULL, position integer NOT NULL, done boolean NOT NULL DEFAULT false,
  UNIQUE(goal_id,position)
);
CREATE TABLE study_cards (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, user_id text NOT NULL REFERENCES users,
  artifact_id uuid, question text NOT NULL, answer text NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(), interval_minutes integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES artifacts(workspace_id,id)
);
CREATE INDEX study_cards_due ON study_cards(workspace_id,user_id,due_at) WHERE archived_at IS NULL;
CREATE TABLE study_reviews (
  id uuid PRIMARY KEY, card_id uuid NOT NULL REFERENCES study_cards,
  rating text NOT NULL CHECK(rating IN ('again','hard','good','easy')),
  reviewed_at timestamptz NOT NULL DEFAULT now(), next_due_at timestamptz NOT NULL
);
CREATE INDEX study_reviews_card_time ON study_reviews(card_id,reviewed_at DESC);
