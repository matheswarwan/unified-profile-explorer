-- ============================================================
-- 002_audit_log.sql
-- Lookup audit log for compliance — individual IDs stored hashed
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id),
  org_id            UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  search_type       TEXT        NOT NULL,  -- email | name | phone
  search_value_hash TEXT        NOT NULL,  -- SHA-256 of the raw search value
  individual_id_hash TEXT,                -- SHA-256 of resolved Unified Individual ID (null if no match)
  result_count      INTEGER     NOT NULL DEFAULT 0,
  queried_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id   ON lookup_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id    ON lookup_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_queried_at ON lookup_audit_log(queried_at DESC);
