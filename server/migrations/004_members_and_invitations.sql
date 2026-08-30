-- Keep the original team account fields for backwards compatibility, while
-- adding real people and team membership for leader/member registration.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE TABLE IF NOT EXISTS members (
  id             BIGSERIAL PRIMARY KEY,
  display_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  email_key      TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash  TEXT NOT NULL,
  team_id        BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_key)
);

CREATE INDEX IF NOT EXISTS members_team_id_idx ON members (team_id);

CREATE TABLE IF NOT EXISTS team_invitations (
  id                    BIGSERIAL PRIMARY KEY,
  team_id               BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id             BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invited_by_member_id  BIGINT REFERENCES members(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_one_pending_per_team_member_idx
  ON team_invitations (team_id, member_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS team_invitations_member_status_idx
  ON team_invitations (member_id, status);
