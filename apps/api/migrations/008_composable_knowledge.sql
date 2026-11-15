ALTER TABLE knowledge_nodes ADD COLUMN event_date text;
ALTER TABLE knowledge_nodes ADD COLUMN event_evidence_id uuid REFERENCES evidence(id);
ALTER TABLE knowledge_nodes ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE INDEX knowledge_node_timeline ON knowledge_nodes(workspace_id,project_id,event_date) WHERE event_date IS NOT NULL;
CREATE INDEX supported_claim_recall ON claims(workspace_id,reviewed_at DESC) WHERE status='supported';
