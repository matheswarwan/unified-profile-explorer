-- ============================================================
-- 001_initial_schema.sql
-- Unified Profile Explorer — initial database schema
-- ============================================================

-- Enable uuid-ossp extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE annotation_type_enum AS ENUM ('edge', 'node_note', 'gap_flag', 'pattern');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE annotation_status_enum AS ENUM ('proposed', 'validated', 'deprecated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE severity_enum AS ENUM ('info', 'warning', 'blocker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE connection_status_enum AS ENUM ('success', 'failed', 'untested');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- ORGS
-- ============================================================

CREATE TABLE IF NOT EXISTS orgs (
  id                     UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name           TEXT                   NOT NULL,
  client_name            TEXT                   NOT NULL,
  instance_url           TEXT                   NOT NULL,
  tenant_id              TEXT                   NOT NULL,
  credentials_encrypted  TEXT                   NOT NULL,
  notes                  TEXT,
  created_at             TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  last_tested_at         TIMESTAMPTZ,
  last_tested_status     connection_status_enum NOT NULL DEFAULT 'untested'
);

CREATE INDEX IF NOT EXISTS idx_orgs_client_name ON orgs(client_name);

-- ============================================================
-- DMO SCHEMA CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS dmo_schema_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  dmo_api_name TEXT        NOT NULL,
  schema_json  JSONB       NOT NULL,
  record_count INTEGER,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_minutes  INTEGER     NOT NULL DEFAULT 60,
  UNIQUE (org_id, dmo_api_name)
);

CREATE INDEX IF NOT EXISTS idx_dmo_schema_cache_org_id ON dmo_schema_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_dmo_schema_cache_cached_at ON dmo_schema_cache(cached_at);

-- ============================================================
-- GRAPH LAYOUTS
-- ============================================================

CREATE TABLE IF NOT EXISTS graph_layouts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layout_json JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_layouts_org_user ON graph_layouts(org_id, user_id);

-- ============================================================
-- ANNOTATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS annotations (
  id                  UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID                   NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  annotation_type     annotation_type_enum   NOT NULL,
  source_dmo          TEXT,
  target_dmo          TEXT,
  source_field        TEXT,
  target_field        TEXT,
  join_type           TEXT CHECK (join_type IN ('inner', 'left')),
  rationale           TEXT,
  status              annotation_status_enum NOT NULL DEFAULT 'proposed',
  is_reusable_pattern BOOLEAN                NOT NULL DEFAULT FALSE,
  pattern_description TEXT,
  severity            severity_enum,
  created_by          UUID                   NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotations_org_id ON annotations(org_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(annotation_type);
CREATE INDEX IF NOT EXISTS idx_annotations_reusable ON annotations(is_reusable_pattern) WHERE is_reusable_pattern = TRUE;
CREATE INDEX IF NOT EXISTS idx_annotations_source_dmo ON annotations(source_dmo);
CREATE INDEX IF NOT EXISTS idx_annotations_target_dmo ON annotations(target_dmo);

-- ============================================================
-- ANNOTATION HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS annotation_history (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id       UUID        NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  changed_by          UUID        NOT NULL REFERENCES users(id),
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_value_json JSONB       NOT NULL,
  change_summary      TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotation_history_annotation_id ON annotation_history(annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_history_changed_at ON annotation_history(changed_at);

-- ============================================================
-- ANNOTATION COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS annotation_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID        NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  author_id     UUID        NOT NULL REFERENCES users(id),
  body          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotation_comments_annotation_id ON annotation_comments(annotation_id);
