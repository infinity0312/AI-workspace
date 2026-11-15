CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE tenants (id text PRIMARY KEY);
CREATE TABLE users (id text PRIMARY KEY);
CREATE TABLE tenant_memberships (
  tenant_id text REFERENCES tenants, user_id text REFERENCES users,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants,
  owner_id text NOT NULL REFERENCES users, name text NOT NULL,
  policy jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE TABLE workspace_memberships (
  workspace_id uuid REFERENCES workspaces ON DELETE CASCADE, user_id text REFERENCES users,
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')), PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE projects (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces,
  name text NOT NULL, description text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (workspace_id,id)
);
CREATE TABLE project_relations (
  workspace_id uuid NOT NULL REFERENCES workspaces, from_id uuid NOT NULL, to_id uuid NOT NULL,
  created_by text NOT NULL REFERENCES users, PRIMARY KEY (from_id,to_id), CHECK (from_id <> to_id),
  FOREIGN KEY (workspace_id, from_id) REFERENCES projects(workspace_id,id),
  FOREIGN KEY (workspace_id, to_id) REFERENCES projects(workspace_id,id)
);
CREATE TABLE artifacts (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, project_id uuid,
  title text NOT NULL, kind text NOT NULL CHECK (kind IN ('note','document')),
  canonical_revision_id uuid, created_by text NOT NULL REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,project_id) REFERENCES projects(workspace_id,id)
);
CREATE INDEX artifacts_workspace_time ON artifacts (workspace_id, updated_at DESC);
CREATE TABLE artifact_revisions (
  id uuid PRIMARY KEY, artifact_id uuid NOT NULL REFERENCES artifacts,
  revision_number integer NOT NULL, parent_revision_id uuid, content_json jsonb NOT NULL,
  content_hash text NOT NULL, author_type text NOT NULL, author_id text NOT NULL REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(artifact_id, revision_number), UNIQUE(artifact_id,id),
  FOREIGN KEY (artifact_id,parent_revision_id) REFERENCES artifact_revisions(artifact_id,id)
);
ALTER TABLE artifacts ADD CONSTRAINT canonical_revision_fk
  FOREIGN KEY (id,canonical_revision_id) REFERENCES artifact_revisions(artifact_id,id);
CREATE TABLE artifact_patches (
  id uuid PRIMARY KEY, artifact_id uuid NOT NULL, base_revision_id uuid NOT NULL,
  proposer_id text NOT NULL REFERENCES users, proposer_type text NOT NULL CHECK (proposer_type IN ('user','agent')),
  operations jsonb NOT NULL, status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  FOREIGN KEY (artifact_id, base_revision_id) REFERENCES artifact_revisions(artifact_id,id)
);
CREATE TABLE idempotency (
  tenant_id text NOT NULL, user_id text NOT NULL, scope text NOT NULL, key text NOT NULL,
  request_hash text NOT NULL, response jsonb,
  PRIMARY KEY (tenant_id,user_id,scope,key)
);
CREATE TABLE domain_outbox (
  server_sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE, tenant_id text NOT NULL, workspace_id uuid NOT NULL,
  event_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);
CREATE INDEX outbox_workspace_sequence ON domain_outbox(workspace_id,server_sequence);
CREATE TABLE audit_log (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, workspace_id uuid NOT NULL, actor_id text NOT NULL,
  action text NOT NULL, resource_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE devices (
  id uuid NOT NULL, user_id text NOT NULL, tenant_id text NOT NULL, workspace_id uuid NOT NULL,
  last_sequence integer NOT NULL DEFAULT 0, acknowledged_cursor bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (workspace_id,user_id,id)
);
