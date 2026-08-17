"""initial Peblo TV catalogue schema

Revision ID: 20260814_01
Revises:
Create Date: 2026-08-14
"""

from alembic import op

revision = "20260814_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS shows (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          section TEXT,
          categories JSONB NOT NULL DEFAULT '[]'::jsonb,
          synopsis TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS seasons (
          id BIGSERIAL PRIMARY KEY,
          show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
          number INTEGER NOT NULL CHECK (number >= 0),
          title TEXT,
          UNIQUE(show_id, number)
        );
        CREATE TABLE IF NOT EXISTS episodes (
          id BIGSERIAL PRIMARY KEY,
          external_id TEXT UNIQUE,
          season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          episode_number INTEGER NOT NULL,
          duration_seconds INTEGER,
          language TEXT NOT NULL,
          content_group TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          UNIQUE(content_group, language)
        );
        CREATE TABLE IF NOT EXISTS artwork (
          id BIGSERIAL PRIMARY KEY,
          show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
          episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('poster', 'banner', 'thumbnail')),
          object_key TEXT NOT NULL,
          url TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          size_bytes INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          UNIQUE(show_id, episode_id, kind)
        );
        CREATE TABLE IF NOT EXISTS catalogue_snapshots (
          version TEXT PRIMARY KEY,
          object_key TEXT NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS catalogue_state (
          singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
          active_version TEXT REFERENCES catalogue_snapshots(version),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS publish_runs (
          id BIGSERIAL PRIMARY KEY,
          version TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          result TEXT NOT NULL,
          detail JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS import_issues (
          id BIGSERIAL PRIMARY KEY,
          external_id TEXT,
          severity TEXT NOT NULL CHECK (severity IN ('warning', 'error')),
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS shows_section_idx ON shows(section);
        CREATE INDEX IF NOT EXISTS episodes_content_group_idx ON episodes(content_group);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS import_issues, publish_runs, catalogue_state, catalogue_snapshots, artwork, episodes, seasons, shows CASCADE")
