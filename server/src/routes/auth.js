import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, withRetry } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  setTeamSessionCookie,
  setAccountSessionCookie,
  clearTeamSessionCookie,
  clearAccountSessionCookie,
  clearAdminSessionCookie,
  requireTeam,
  requireAccount,
} from "../auth.js";
import { emit } from "../live.js";

const router = Router();

// Same reasoning as the submissions limiter: hackathon venues share one
// public IP across everyone. A registration burst at event start hits
// this exactly like a submission burst hits the deadline — same fix,
// same ceiling.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a moment and try again." },
});

const signupSchema = z.object({
  role: z.enum(["leader", "member"]),
  name: z.string().trim().min(2).max(100),
  personalPassword: z.string().min(8).max(200),
  teamName: z.string().trim().min(2).max(100),
  teamPassword: z.string().min(8).max(200),
  memberCount: z.coerce.number().int().min(1).max(5).optional(),
});

const loginSchema = z.object({
  name: z.string().trim().min(2).max(100),
  personalPassword: z.string().min(8).max(200),
  teamName: z.string().trim().min(2).max(100),
  teamPassword: z.string().min(8).max(200),
});

const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(200),
  email: z.string().trim().email().max(200).optional(),
  handle: z.string().trim().regex(/^@?[a-zA-Z0-9_.-]{2,40}$/).optional(),
  techStack: z.array(z.string().trim().min(1).max(60)).max(12).optional().default([]),
  licenceLevel: z.enum(["student", "professional", "first-time-hackathoner"]).optional().default("first-time-hackathoner"),
});

const teamSetupSchema = z.object({
  teamName: z.string().trim().min(2).max(100),
  teamPassword: z.string().min(8).max(200),
  memberCount: z.coerce.number().int().min(1).max(5).optional(),
  trackId: z.coerce.string().regex(/^\d+$/).optional(),
});

function teamResponse(team, member) {
  return {
    id: team.id, teamName: team.team_name, memberId: member.id,
    memberName: member.member_name, isLeader: member.is_leader,
    memberCount: team.member_count,
    pitPassCode: team.pit_pass_code,
  };
}

function createPitPassCode(teamName) {
  const prefix = teamName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5).padEnd(5, "X");
  return `${prefix}-${crypto.randomInt(1000, 10000)}`;
}

router.post("/account/register", authLimiter, async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid account details." });
  try {
    const result = await pool.query(
      `INSERT INTO accounts (account_name, password_hash, email, handle, tech_stack, licence_level, role_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'FREE_AGENT')
       RETURNING id, account_name, email, handle, tech_stack, licence_level, role_type`,
      [parsed.data.name, await hashPassword(parsed.data.password), parsed.data.email ?? null, parsed.data.handle ?? null, parsed.data.techStack, parsed.data.licenceLevel],
    );
    const account = result.rows[0];
    clearTeamSessionCookie(res);
    clearAdminSessionCookie(res);
    setAccountSessionCookie(res, { role: "account", accountId: account.id });
    return res.status(201).json({ account: { id: account.id, name: account.account_name, email: account.email, handle: account.handle, techStack: account.tech_stack, licenceLevel: account.licence_level, roleType: account.role_type }, teams: [] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That account name is already taken." });
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/account/login", authLimiter, async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid account details." });
  const result = await pool.query("SELECT id, account_name, email, handle, tech_stack, licence_level, role_type, password_hash FROM accounts WHERE account_name_key = lower($1) OR email_key = lower($1) OR handle_key = lower($1)", [parsed.data.name]);
  const account = result.rows[0];
  if (!account || !(await verifyPassword(parsed.data.password, account.password_hash))) return res.status(401).json({ error: "Incorrect account name or password." });
  clearTeamSessionCookie(res);
  clearAdminSessionCookie(res);
  setAccountSessionCookie(res, { role: "account", accountId: account.id });
  const teams = await pool.query(
    `SELECT t.id, t.team_name AS "teamName", t.member_count AS "memberCount",
            tm.id AS "memberId", tm.member_name AS "memberName", tm.is_leader AS "isLeader"
     FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.account_id = $1 ORDER BY tm.created_at`,
    [account.id],
  );
  return res.json({ account: { id: account.id, name: account.account_name, email: account.email, handle: account.handle, techStack: account.tech_stack, licenceLevel: account.licence_level, roleType: account.role_type }, teams: teams.rows });
});

router.get("/account/me", requireAccount, async (req, res) => {
  const teams = await pool.query(
    `SELECT t.id, t.team_name AS "teamName", t.member_count AS "memberCount",
            tm.id AS "memberId", tm.member_name AS "memberName", tm.is_leader AS "isLeader"
     FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.account_id = $1 ORDER BY tm.created_at`,
    [req.account.id],
  );
  res.json({ account: req.account, teams: teams.rows });
});

router.post("/account/logout", (req, res) => {
  clearAccountSessionCookie(res);
  clearTeamSessionCookie(res);
  res.json({ success: true });
});

router.post("/team/create", requireAccount, async (req, res) => {
  const parsed = teamSetupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid team details." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingLeader = await client.query(
      "SELECT 1 FROM team_members WHERE account_id = $1 AND is_leader = true FOR UPDATE",
      [req.account.id],
    );
    if (existingLeader.rowCount > 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(409).json({ error: "A team leader can create only one team." });
    }
    let teamResult;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        teamResult = await client.query(
          `INSERT INTO teams (team_name, password_hash, team_role, member_count, pit_pass_code, track_id) VALUES ($1, $2, 'leader', $3, $4, $5) RETURNING id, team_name, member_count, pit_pass_code`,
          [parsed.data.teamName, await hashPassword(parsed.data.teamPassword), parsed.data.memberCount ?? 1, createPitPassCode(parsed.data.teamName), parsed.data.trackId || null],
        );
        break;
      } catch (err) {
        if (err.code !== "23505" || attempt === 4) throw err;
      }
    }
    const team = teamResult.rows[0];
    const memberResult = await client.query(
      `INSERT INTO team_members (team_id, account_id, member_name, password_hash, is_leader) VALUES ($1, $2, $3, $4, true) RETURNING id, member_name, is_leader`,
      [team.id, req.account.id, req.account.name, "account-session"],
    );
    await client.query("COMMIT");
    client.release();
    clearAdminSessionCookie(res);
    setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: memberResult.rows[0].id });
    await pool.query("UPDATE accounts SET role_type = 'LEADER' WHERE id = $1", [req.account.id]);
    return res.status(201).json({ team: teamResponse(team, memberResult.rows[0]) });
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    client?.release();
    if (err.code === "23505") return res.status(409).json({ error: "That team name is already taken." });
    console.error("Team creation failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/team/join", requireAccount, async (req, res) => {
  const parsed = z.object({
    pitPassCode: z.string().trim().regex(/^[A-Z0-9]{3,8}-?[A-Z0-9]{3,6}$/i).optional(),
    teamName: z.string().trim().min(2).max(100).optional(),
    teamPassword: z.string().min(8).max(200),
  }).refine((value) => value.pitPassCode || value.teamName, "A pit pass code or team name is required").safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid team details." });
  const teamResult = await pool.query(
    `SELECT id, team_name, password_hash, banned, member_count, pit_pass_code,
            (SELECT count(*) FROM team_members WHERE team_id = teams.id) AS current_members
     FROM teams WHERE ($1::text IS NOT NULL AND upper(pit_pass_code) = upper($1))
        OR ($2::text IS NOT NULL AND team_name_key = lower($2))`,
    [parsed.data.pitPassCode || null, parsed.data.teamName || null],
  );
  const team = teamResult.rows[0];
  if (!team || !(await verifyPassword(parsed.data.teamPassword, team.password_hash))) return res.status(401).json({ error: "Incorrect team name or team password." });
  if (team.banned) return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
  const existingMembership = await pool.query(
    "SELECT id, member_name, is_leader FROM team_members WHERE team_id = $1 AND account_id = $2",
    [team.id, req.account.id],
  );
  if (existingMembership.rows[0]) {
    clearAdminSessionCookie(res);
    setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: existingMembership.rows[0].id });
    return res.json({ team: teamResponse(team, existingMembership.rows[0]) });
  }
  if (Number(team.current_members) >= team.member_count) return res.status(409).json({ error: "This team has reached its member limit." });
  try {
    const memberResult = await pool.query("INSERT INTO team_members (team_id, account_id, member_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, member_name, is_leader", [team.id, req.account.id, req.account.name, "account-session"]);
    clearAdminSessionCookie(res);
    setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: memberResult.rows[0].id });
    await pool.query("UPDATE accounts SET role_type = 'MEMBER' WHERE id = $1", [req.account.id]);
    return res.status(201).json({ team: teamResponse(team, memberResult.rows[0]) });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "You are already on this team or that name is already used." });
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/account/free-agent", requireAccount, async (req, res) => {
  const membership = await pool.query("SELECT 1 FROM team_members WHERE account_id = $1 LIMIT 1", [req.account.id]);
  if (membership.rowCount > 0) {
    return res.status(409).json({ error: "Team members cannot become free agents while they belong to a team." });
  }
  await pool.query("UPDATE accounts SET role_type = 'FREE_AGENT' WHERE id = $1", [req.account.id]);
  res.json({ account: { ...req.account, roleType: "FREE_AGENT" } });
});

router.post("/register", authLimiter, async (req, res) => {
  if (req.body?.password && !req.body?.personalPassword) {
    const legacy = z.object({ teamName: z.string().trim().min(2).max(100), password: z.string().min(8).max(200) }).safeParse(req.body);
    if (!legacy.success) return res.status(400).json({ error: "Invalid input" });
    try {
      if (req.body.role === "member") {
        const existing = await pool.query("SELECT id, team_name, password_hash, banned FROM teams WHERE team_name_key = lower($1)", [legacy.data.teamName]);
        const team = existing.rows[0];
        if (!team || !(await verifyPassword(legacy.data.password, team.password_hash))) return res.status(401).json({ error: "Incorrect team name or password." });
        if (team.banned) return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
        setTeamSessionCookie(res, { role: "team", teamId: team.id });
        clearAdminSessionCookie(res);
        return res.status(201).json({ team: { id: team.id, teamName: team.team_name } });
      }
      const passwordHash = await hashPassword(legacy.data.password);
      const legacyMemberCount = Number.isInteger(Number(req.body.memberCount)) ? Math.min(5, Math.max(1, Number(req.body.memberCount))) : 1;
      const result = await pool.query(
        `INSERT INTO teams (team_name, password_hash, member_count) VALUES ($1, $2, $3) RETURNING id, team_name`,
        [legacy.data.teamName, passwordHash, legacyMemberCount],
      );
      const team = result.rows[0];
      setTeamSessionCookie(res, { role: "team", teamId: team.id });
      clearAdminSessionCookie(res);
      return res.status(201).json({ team: { id: team.id, teamName: team.team_name } });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "That team name is already taken." });
      return res.status(503).json({ error: "Server is busy right now. Please retry." });
    }
  }
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }
  const { role, name, personalPassword, teamName, teamPassword, memberCount } = parsed.data;

  if (role === "member") {
    if (memberCount !== undefined) {
      return res.status(400).json({ error: "Member count is only required for team leaders." });
    }
    try {
      const result = await pool.query(
        `SELECT id, team_name, password_hash, banned, member_count,
                (SELECT count(*) FROM team_members tm WHERE tm.team_id = teams.id) AS current_members
         FROM teams WHERE team_name_key = lower($1)`,
        [teamName],
      );
      const team = result.rows[0];
      if (!team || !(await verifyPassword(teamPassword, team.password_hash))) {
        return res.status(401).json({ error: "Incorrect team or team password." });
      }
      if (team.banned) {
        return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
      }
      if (Number(team.current_members) >= team.member_count) {
        return res.status(409).json({ error: "This team has reached its member limit." });
      }
      const member = await pool.query(
        `INSERT INTO team_members (team_id, member_name, password_hash)
         VALUES ($1, $2, $3) RETURNING id, member_name, is_leader`,
        [team.id, name, await hashPassword(personalPassword)],
      );
      clearAdminSessionCookie(res);
      setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: member.rows[0].id });
      return res.status(201).json({ team: { id: team.id, teamName: team.team_name, memberId: member.rows[0].id, memberName: member.rows[0].member_name, isLeader: false, memberCount: team.member_count } });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "That member name is already used on this team." });
      }
      console.error("Member register failed:", err);
      return res.status(503).json({ error: "Server is busy right now. Please retry." });
    }
  }

  let client;
  try {
    client = await pool.connect();
    const teamPasswordHash = await hashPassword(teamPassword);
    const personalPasswordHash = await hashPassword(personalPassword);
    await client.query("BEGIN");
    const result = await withRetry(() =>
      client.query(
        `INSERT INTO teams (team_name, password_hash, team_role, member_count)
         VALUES ($1, $2, $3, $4)
         RETURNING id, team_name`,
        [teamName, teamPasswordHash, "leader", memberCount ?? 1],
      ),
    );
    const team = result.rows[0];
    const member = await client.query(
      `INSERT INTO team_members (team_id, member_name, password_hash, is_leader)
       VALUES ($1, $2, $3, true) RETURNING id, member_name`,
      [team.id, name, personalPasswordHash],
    );
    await client.query("COMMIT");
    client.release();
    clearAdminSessionCookie(res);
    setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: member.rows[0].id });
    emit({ type: "team_joined", teamName: team.team_name, at: new Date().toISOString() });
    return res.status(201).json({ team: { id: team.id, teamName: team.team_name, memberId: member.rows[0].id, memberName: member.rows[0].member_name, isLeader: true, memberCount: memberCount ?? 1 } });
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    client?.release();
    if (err.code === "23505") {
      return res.status(409).json({ error: "That team name is already taken." });
    }
    console.error("Register failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  if (req.body?.password && !req.body?.personalPassword) {
    const legacy = z.object({ teamName: z.string().trim().min(2).max(100), password: z.string().min(8).max(200) }).safeParse(req.body);
    if (!legacy.success) return res.status(400).json({ error: "Invalid input" });
    const result = await pool.query("SELECT id, team_name, password_hash, banned FROM teams WHERE team_name_key = lower($1)", [legacy.data.teamName]);
    const team = result.rows[0];
    if (!team || !(await verifyPassword(legacy.data.password, team.password_hash))) return res.status(401).json({ error: "Incorrect team name or password." });
    if (team.banned) return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    setTeamSessionCookie(res, { role: "team", teamId: team.id });
    clearAdminSessionCookie(res);
    return res.json({ team: { id: team.id, teamName: team.team_name } });
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { name, personalPassword, teamName, teamPassword } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT t.id, t.team_name, t.password_hash, t.banned, t.member_count,
          m.id AS member_id, m.member_name, m.password_hash AS member_password_hash, m.is_leader
       FROM teams t JOIN team_members m ON m.team_id = t.id AND m.member_name_key = lower($2)
       WHERE t.team_name_key = lower($1)`,
      [teamName, name],
    );
    const team = result.rows[0];
    // Same generic message whether the team doesn't exist or the
    // password is wrong — don't leak which teams are registered.
    if (!team || !(await verifyPassword(teamPassword, team.password_hash)) || !(await verifyPassword(personalPassword, team.member_password_hash))) {
      return res.status(401).json({ error: "Incorrect name or password." });
    }
    if (team.banned) {
      return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    }
    clearAdminSessionCookie(res);
    setTeamSessionCookie(res, { role: "team", teamId: team.id, memberId: team.member_id });
    return res.json({ team: { id: team.id, teamName: team.team_name, memberId: team.member_id, memberName: team.member_name, isLeader: team.is_leader, memberCount: team.member_count } });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/logout", (req, res) => {
  clearTeamSessionCookie(res);
  res.json({ success: true });
});

router.get("/me", requireTeam, (req, res) => {
  pool.query(
    `SELECT id, member_name AS name, is_leader AS "isLeader"
     FROM team_members WHERE team_id = $1 ORDER BY is_leader DESC, created_at ASC`,
    [req.team.id],
  ).then((result) => res.json({ team: { ...req.team, members: result.rows } })).catch((err) => res.status(503).json({ error: "Unable to load team." }));
});

export default router;
