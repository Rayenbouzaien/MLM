-- One row per team. team_name_key is a generated, lowercased column so
-- "Telemetry Titans" and "telemetry titans" collide as the same team
-- instead of creating duplicate rows during a submission burst.
CREATE TABLE IF NOT EXISTS submissions (
  id             BIGSERIAL PRIMARY KEY,
  team_name      TEXT NOT NULL,
  team_name_key  TEXT GENERATED ALWAYS AS (lower(team_name)) STORED,
  github_url     TEXT NOT NULL,
  drive_url      TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_name_key)
);

CREATE INDEX IF NOT EXISTS submissions_submitted_at_idx ON submissions (submitted_at);
