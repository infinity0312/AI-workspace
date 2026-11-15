CREATE TABLE runtime_sessions (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runtime_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  session_id uuid NOT NULL REFERENCES runtime_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  step_id uuid,
  idempotency_key text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,idempotency_key)
);
CREATE INDEX runtime_events_session_cursor ON runtime_events(session_id,sequence);
