CREATE TABLE assets (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces,
  owner_id text NOT NULL REFERENCES users, filename text NOT NULL, mime text NOT NULL,
  content_hash text NOT NULL, size_bytes integer NOT NULL, storage_key text NOT NULL,
  storage_mode text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);
CREATE TABLE sources (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, project_id uuid,
  title text NOT NULL, canonical_url text, asset_id uuid, rights text NOT NULL, sensitivity text NOT NULL,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,project_id) REFERENCES projects(workspace_id,id),
  FOREIGN KEY (workspace_id,asset_id) REFERENCES assets(workspace_id,id)
);
CREATE UNIQUE INDEX sources_workspace_url ON sources (workspace_id, canonical_url) WHERE canonical_url IS NOT NULL;
CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES sources,
  content_hash text NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,id)
);
CREATE TABLE documents (
  id uuid PRIMARY KEY, source_id uuid NOT NULL, snapshot_id uuid NOT NULL,
  parser_version text NOT NULL, quality_report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,id),
  FOREIGN KEY(source_id,snapshot_id) REFERENCES source_snapshots(source_id,id)
);
CREATE TABLE passages (
  id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents, ordinal integer NOT NULL,
  page integer, offset_utf16 integer NOT NULL, content text NOT NULL,
  search_text tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding vector, UNIQUE(document_id,ordinal), UNIQUE(document_id,id)
);
CREATE INDEX passages_full_text ON passages USING gin(search_text);
CREATE TABLE evidence (
  id uuid PRIMARY KEY, source_id uuid NOT NULL, document_id uuid NOT NULL, passage_id uuid NOT NULL,
  snapshot_id uuid NOT NULL, locator jsonb NOT NULL, quote text NOT NULL,
  verification_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id,document_id) REFERENCES documents(source_id,id),
  FOREIGN KEY (source_id,snapshot_id) REFERENCES source_snapshots(source_id,id),
  FOREIGN KEY (document_id,passage_id) REFERENCES passages(document_id,id)
);
CREATE INDEX evidence_source ON evidence(source_id);
CREATE TABLE claims (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, statement text NOT NULL,
  scope text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE claim_evidence (
  claim_id uuid REFERENCES claims, evidence_id uuid REFERENCES evidence,
  PRIMARY KEY (claim_id,evidence_id)
);
CREATE TABLE knowledge_nodes (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, project_id uuid,
  title text NOT NULL, type text NOT NULL, description text NOT NULL,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES projects(workspace_id,id)
);
CREATE TABLE knowledge_edges (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces, from_node_id uuid NOT NULL,
  to_node_id uuid NOT NULL, relation_type text NOT NULL, evidence_id uuid REFERENCES evidence,
  status text NOT NULL, created_by text NOT NULL REFERENCES users, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(from_node_id <> to_node_id),
  FOREIGN KEY(workspace_id,from_node_id) REFERENCES knowledge_nodes(workspace_id,id),
  FOREIGN KEY(workspace_id,to_node_id) REFERENCES knowledge_nodes(workspace_id,id)
);
CREATE INDEX knowledge_edges_from ON knowledge_edges(workspace_id,from_node_id);
CREATE INDEX knowledge_edges_to ON knowledge_edges(workspace_id,to_node_id);
