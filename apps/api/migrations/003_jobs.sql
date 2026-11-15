CREATE TABLE jobs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces,
  tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED', input jsonb NOT NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb, result jsonb,
  lease_id uuid, lease_expires_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('QUEUED','PLANNING','RUNNING','PAUSED','COMPLETED','PARTIAL','FAILED','CANCELLED','BUDGET_EXHAUSTED'))
);
CREATE INDEX jobs_available ON jobs(status,lease_expires_at,created_at);
CREATE TABLE job_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, run_id uuid NOT NULL REFERENCES jobs,
  event_type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_by_run ON job_events(run_id,sequence);
CREATE TABLE model_usage (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces,
  run_id uuid NOT NULL REFERENCES jobs, provider text NOT NULL, model text NOT NULL,
  input_tokens integer NOT NULL, output_tokens integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
