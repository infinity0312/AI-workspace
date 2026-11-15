CREATE TABLE runtime_journal (
  session_id uuid NOT NULL REFERENCES runtime_sessions(id) ON DELETE CASCADE,
  invocation text NOT NULL,
  round_no integer NOT NULL CHECK (round_no BETWEEN 0 AND 2),
  entry_key text NOT NULL,
  sealed_payload text NOT NULL,
  PRIMARY KEY (session_id,invocation,round_no,entry_key)
);
