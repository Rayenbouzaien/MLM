import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, withRetry } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  requireTeam,
  requireMember,
  requireLeader,
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

const credentialsSchema = z.object({
  teamName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(200),
});

const memberCredentialsSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
});

const leaderRegistrationSchema = memberCredentialsSchema.extend({
  teamName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().default(""),
  logoUrl: z.string().trim().url().max(2048).refine((value) => /^https?:\/\//i.test(value), {
    message: "Logo URL must use http or https.",
  }).optional().or(z.literal("")),
});

const invitationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

function publicMember(member) {
  return {
    id: member.id,
    displayName: member.display_name,
    email: member.email,
    role: member.role,
    teamId: member.team_id,
  };
}

function setMemberCookies(res, member, team = null) {
  setSessionCookie(res, { role: "member", memberId: member.id });
  if (team) {
    setSessionCookie(res, {
      role: "team",
      teamId: team.id,
      teamName: team.team_name,
      memberId: member.id,
    });
  }
}

router.post("/register", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }
  const { teamName, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const result = await withRetry(() =>
      pool.query(
        `INSERT INTO teams (team_name, password_hash) VALUES ($1, $2)
         RETURNING id, team_name`,
        [teamName, passwordHash],
      ),
    );
    const team = result.rows[0];
    setSessionCookie(res, { role: "team", teamId: team.id, teamName: team.team_name });
    emit({ type: "team_joined", teamName: team.team_name, at: new Date().toISOString() });
    return res.status(201).json({ team: { id: team.id, teamName: team.team_name } });
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on team_name_key
      return res.status(409).json({ error: "That team name is already taken." });
    }
    console.error("Register failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

// New flow: a leader is a personal account that owns a team. The original
// /register route remains intact for already-created team accounts.
router.post("/leader/register", authLimiter, async (req, res) => {
  const parsed = leaderRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  const { teamName, description, displayName, email, password } = parsed.data;
  const logoUrl = parsed.data.logoUrl || null;
  let client;
  try {
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query("BEGIN");
    const teamResult = await client.query(
      `INSERT INTO teams (team_name, password_hash, description, logo_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, team_name, description, logo_url`,
      [teamName, passwordHash, description, logoUrl],
    );
    const team = teamResult.rows[0];
    const memberResult = await client.query(
      `INSERT INTO members (display_name, email, password_hash, team_id, role)
       VALUES ($1, $2, $3, $4, 'leader')
       RETURNING id, display_name, email, role, team_id`,
      [displayName, email, passwordHash, team.id],
    );
    const member = memberResult.rows[0];
    await client.query("COMMIT");

    setMemberCookies(res, member, team);
    emit({ type: "team_joined", teamName: team.team_name, at: new Date().toISOString() });
    emit({ type: "data_changed", resource: "teams", at: new Date().toISOString() });
    return res.status(201).json({
      team: { id: team.id, teamName: team.team_name, description: team.description, logoUrl: team.logo_url },
      member: publicMember(member),
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return res.status(409).json({ error: "That team name or member email is already registered." });
    }
    console.error("Leader registration failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  } finally {
    client?.release();
  }
});

router.post("/member/register", authLimiter, async (req, res) => {
  const parsed = memberCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await pool.query(
      `INSERT INTO members (display_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, display_name, email, role, team_id`,
      [parsed.data.displayName, parsed.data.email, passwordHash],
    );
    const member = result.rows[0];
    setMemberCookies(res, member);
    return res.status(201).json({ member: publicMember(member) });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email is already registered." });
    console.error("Member registration failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { teamName, password } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT id, team_name, password_hash, banned FROM teams WHERE team_name_key = lower($1)`,
      [teamName],
    );
    const team = result.rows[0];
    // Same generic message whether the team doesn't exist or the
    // password is wrong — don't leak which teams are registered.
    if (!team || !(await verifyPassword(password, team.password_hash))) {
      return res.status(401).json({ error: "Incorrect team name or password." });
    }
    if (team.banned) {
      return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    }
    setSessionCookie(res, { role: "team", teamId: team.id, teamName: team.team_name });
    return res.json({ team: { id: team.id, teamName: team.team_name } });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/member/login", authLimiter, async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(200),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    const result = await pool.query(
      `SELECT m.id, m.display_name, m.email, m.password_hash, m.role, m.team_id,
              t.team_name, t.description, t.logo_url, t.banned
       FROM members m
       LEFT JOIN teams t ON t.id = m.team_id
       WHERE m.email_key = lower($1)`,
      [parsed.data.email],
    );
    const member = result.rows[0];
    if (!member || !(await verifyPassword(parsed.data.password, member.password_hash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const team = member.team_id && !member.banned
      ? { id: member.team_id, team_name: member.team_name, description: member.description, logo_url: member.logo_url }
      : null;
    setMemberCookies(res, member, team);
    return res.json({
      member: publicMember(member),
      team: team ? { id: team.id, teamName: team.team_name, description: team.description, logoUrl: team.logo_url } : null,
    });
  } catch (err) {
    console.error("Member login failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res, "team");
  res.json({ success: true });
});

router.post("/member/logout", (req, res) => {
  clearSessionCookie(res, ["member", "team"]);
  res.json({ success: true });
});

router.get("/me", requireTeam, (req, res) => {
  res.json({ team: req.team });
});

router.get("/member/me", requireMember, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.created_at, t.id AS team_id, t.team_name, t.description, t.logo_url,
              inviter.display_name AS invited_by
       FROM team_invitations i
       JOIN teams t ON t.id = i.team_id
       LEFT JOIN members inviter ON inviter.id = i.invited_by_member_id
       WHERE i.member_id = $1 AND i.status = 'pending' AND NOT t.banned
       ORDER BY i.created_at DESC`,
      [req.member.id],
    );
    res.json({
      member: {
        id: req.member.id,
        displayName: req.member.displayName,
        email: req.member.email,
        role: req.member.role,
        team: req.member.team,
      },
      invitations: result.rows.map((invite) => ({
        id: invite.id,
        createdAt: invite.created_at,
        invitedBy: invite.invited_by,
        team: { id: invite.team_id, teamName: invite.team_name, description: invite.description, logoUrl: invite.logo_url },
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/team/members", requireTeam, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, display_name,
              CASE WHEN $2::boolean THEN email ELSE NULL END AS email,
              role, created_at
       FROM members WHERE team_id = $1
       ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, created_at ASC`,
      [req.team.id, req.team.memberRole === "leader"],
    );
    res.json({ members: result.rows.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      email: member.email,
      role: member.role,
      createdAt: member.created_at,
    })) });
  } catch (err) {
    next(err);
  }
});

router.post("/team/invitations", requireTeam, requireLeader, async (req, res, next) => {
  const parsed = invitationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid member email." });
  try {
    const memberResult = await pool.query(
      "SELECT id, display_name, email, team_id FROM members WHERE email_key = lower($1)",
      [parsed.data.email],
    );
    const member = memberResult.rows[0];
    if (!member) return res.status(404).json({ error: "No registered member exists with that email." });
    if (member.team_id) return res.status(409).json({ error: "That member is already assigned to a team." });

    const invitationResult = await pool.query(
      `INSERT INTO team_invitations (team_id, member_id, invited_by_member_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, member_id) WHERE status = 'pending' DO NOTHING
       RETURNING id, created_at`,
      [req.team.id, member.id, req.team.memberId],
    );
    if (!invitationResult.rows[0]) return res.status(409).json({ error: "That member already has a pending invitation." });
    res.status(201).json({ invitation: {
      id: invitationResult.rows[0].id,
      createdAt: invitationResult.rows[0].created_at,
      member: { id: member.id, displayName: member.display_name, email: member.email },
    } });
  } catch (err) {
    next(err);
  }
});

router.get("/invitations", requireMember, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.created_at, t.id AS team_id, t.team_name, t.description, t.logo_url,
              inviter.display_name AS invited_by
       FROM team_invitations i
       JOIN teams t ON t.id = i.team_id
       LEFT JOIN members inviter ON inviter.id = i.invited_by_member_id
       WHERE i.member_id = $1 AND i.status = 'pending' AND NOT t.banned
       ORDER BY i.created_at DESC`,
      [req.member.id],
    );
    res.json({ invitations: result.rows.map((invite) => ({
      id: invite.id,
      createdAt: invite.created_at,
      invitedBy: invite.invited_by,
      team: { id: invite.team_id, teamName: invite.team_name, description: invite.description, logoUrl: invite.logo_url },
    })) });
  } catch (err) {
    next(err);
  }
});

router.post("/invitations/:id/accept", requireMember, async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const invitationResult = await client.query(
      `SELECT i.id, i.team_id, t.team_name, t.description, t.logo_url
       FROM team_invitations i
       JOIN teams t ON t.id = i.team_id
       WHERE i.id = $1 AND i.member_id = $2 AND i.status = 'pending' AND NOT t.banned
       FOR UPDATE`,
      [req.params.id, req.member.id],
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invitation not found." });
    }
    const memberResult = await client.query(
      `UPDATE members SET team_id = $1, role = 'member'
       WHERE id = $2 AND team_id IS NULL
       RETURNING id, display_name, email, role, team_id`,
      [invitation.team_id, req.member.id],
    );
    if (!memberResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "You are already assigned to a team." });
    }
    await client.query(
      "UPDATE team_invitations SET status = 'accepted', responded_at = now() WHERE id = $1",
      [invitation.id],
    );
    await client.query("COMMIT");

    const member = memberResult.rows[0];
    setSessionCookie(res, { role: "team", teamId: invitation.team_id, teamName: invitation.team_name, memberId: member.id });
    emit({ type: "data_changed", resource: "teams", at: new Date().toISOString() });
    return res.json({
      member: publicMember(member),
      team: { id: invitation.team_id, teamName: invitation.team_name, description: invitation.description, logoUrl: invitation.logo_url },
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client?.release();
  }
});

router.post("/invitations/:id/decline", requireMember, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE team_invitations SET status = 'declined', responded_at = now()
       WHERE id = $1 AND member_id = $2 AND status = 'pending'
       RETURNING id`,
      [req.params.id, req.member.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Invitation not found." });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
