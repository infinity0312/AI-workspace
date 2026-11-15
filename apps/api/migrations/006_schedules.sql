CREATE TABLE research_schedules (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  target jsonb NOT NULL,
  cadence_hours int NOT NULL CHECK (cadence_hours BETWEEN 1 AND 720),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  last_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  last_skip_reason text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_schedules_due_idx ON research_schedules(next_run_at) WHERE enabled;
CREATE INDEX research_schedules_actor_idx ON research_schedules(workspace_id,user_id);
