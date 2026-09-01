-- Teams are now real accounts (password auth) instead of free-text names
-- typed into the submission form — closes the "anyone can overwrite
-- anyone's submission by typing their name" hole from v1.
CREATE TABLE IF NOT EXISTS teams (
  id             BIGSERIAL PRIMARY KEY,
  team_name      TEXT NOT NULL,
  team_name_key  TEXT GENERATED ALWAYS AS (lower(team_name)) STORED,
  password_hash  TEXT NOT NULL,
  team_role      TEXT NOT NULL DEFAULT 'leader' CHECK (team_role IN ('leader', 'member')),
  member_count   INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 1),
  banned         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_name_key)
);

-- Upgrade databases created by the earlier teams schema.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_name_key TEXT GENERATED ALWAYS AS (lower(team_name)) STORED;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_role TEXT NOT NULL DEFAULT 'leader' CHECK (team_role IN ('leader', 'member'));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 1);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS teams_team_name_key_idx ON teams (team_name_key);

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
