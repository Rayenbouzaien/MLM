-- Teams are now real accounts (password auth) instead of free-text names
-- typed into the submission form — closes the "anyone can overwrite
-- anyone's submission by typing their name" hole from v1.
CREATE TABLE IF NOT EXISTS teams (
  id             BIGSERIAL PRIMARY KEY,
  team_name      TEXT NOT NULL,
  team_name_key  TEXT GENERATED ALWAYS AS (lower(team_name)) STORED,
  password_hash  TEXT NOT NULL,
  banned         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_name_key)
);

CREATE TABLE IF NOT EXISTS challenges (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  deliverables  TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '#E10600',
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link submissions to real team accounts. Old free-text team_name stays
-- (useful audit trail / display) but new submissions are keyed by
-- team_id, which is what auth actually controls.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_team_id_key ON submissions (team_id);
