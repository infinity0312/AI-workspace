ALTER TABLE sources ADD COLUMN lifecycle text NOT NULL DEFAULT 'active'
  CHECK (lifecycle IN ('active','updated','inaccessible','retracted','archived'));
ALTER TABLE sources ADD COLUMN checked_at timestamptz;
ALTER TABLE sources ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE sources ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE claims ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE claims ADD COLUMN reviewed_at timestamptz;
ALTER TABLE assets ADD COLUMN visibility text NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('workspace','capture'));
ALTER TABLE domain_outbox ADD COLUMN audience_user_id text;

CREATE INDEX sources_workspace_lifecycle ON sources(workspace_id,lifecycle);
CREATE INDEX documents_source_time ON documents(source_id,created_at DESC,id);
CREATE INDEX artifacts_trashed ON artifacts(workspace_id,deleted_at DESC) WHERE deleted_at IS NOT NULL;

CREATE TABLE claim_reviews (
  id uuid PRIMARY KEY, claim_id uuid NOT NULL REFERENCES claims, actor_id text NOT NULL REFERENCES users,
  previous_status text NOT NULL, decision text NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_reviews_claim_time ON claim_reviews(claim_id,created_at DESC);

CREATE TABLE capture_items (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces,
  user_id text NOT NULL REFERENCES users, title text NOT NULL, text_body text,
  url text, asset_id uuid, status text NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox','processed','dismissed')),
  sensitivity text NOT NULL, rights text NOT NULL, result_kind text, result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(text_body,url,asset_id)=1),
  FOREIGN KEY(workspace_id,asset_id) REFERENCES assets(workspace_id,id)
);
CREATE INDEX capture_owner_time ON capture_items(workspace_id,user_id,created_at DESC);
