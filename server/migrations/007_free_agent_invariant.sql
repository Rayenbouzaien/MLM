CREATE OR REPLACE FUNCTION sync_account_role_for_team_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE accounts SET role_type = 'MEMBER' WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_members_sync_account_role ON team_members;
CREATE TRIGGER team_members_sync_account_role
AFTER INSERT ON team_members
FOR EACH ROW EXECUTE FUNCTION sync_account_role_for_team_membership();

CREATE OR REPLACE FUNCTION prevent_free_agent_with_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_type = 'FREE_AGENT' AND EXISTS (
    SELECT 1 FROM team_members WHERE account_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'An account with team membership cannot be a free agent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accounts_prevent_free_agent_membership ON accounts;
CREATE TRIGGER accounts_prevent_free_agent_membership
BEFORE UPDATE OF role_type ON accounts
FOR EACH ROW EXECUTE FUNCTION prevent_free_agent_with_membership();
