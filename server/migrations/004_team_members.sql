CREATE TABLE IF NOT EXISTS team_members (
  id            BIGSERIAL PRIMARY KEY,
  team_id       BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_name   TEXT NOT NULL,
  member_name_key TEXT GENERATED ALWAYS AS (lower(member_name)) STORED,
  password_hash TEXT NOT NULL,
  is_leader     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_name_key)
);

CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members (team_id);

-- Existing teams predate individual accounts. Keep their team credentials
-- usable while new accounts are created through the member flow.
