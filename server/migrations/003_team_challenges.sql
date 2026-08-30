CREATE TABLE IF NOT EXISTS team_challenges (
  team_id      BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  challenge_id BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  selected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS team_challenges_challenge_id_idx ON team_challenges (challenge_id);

-- Team identity is now enforced by `team_id`; retaining the old free-text
-- uniqueness constraint can race with that upsert under a submission burst.
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_team_name_key_key;
