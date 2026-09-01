CREATE TABLE IF NOT EXISTS accounts (
  id            BIGSERIAL PRIMARY KEY,
  account_name  TEXT NOT NULL,
  account_name_key TEXT GENERATED ALWAYS AS (lower(account_name)) STORED,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_name_key)
);

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS team_members_account_team_idx ON team_members (account_id, team_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_members_account_id_idx ON team_members (account_id);
