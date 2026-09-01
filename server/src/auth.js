import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "./db.js";

// Fail fast, not silently: a hackathon submission system with a weak or
// missing session secret is a security measure, and ponytail explicitly
// says never simplify those away. Better to crash at boot than run with
// forgeable sessions.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error(
    "JWT_SECRET env var is missing or too short (need 16+ chars). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

const TEAM_COOKIE_NAME = "team_session";
const ACCOUNT_COOKIE_NAME = "account_session";
const ADMIN_COOKIE_NAME = "admin_session";
const TOKEN_TTL = "12h";

// Cross-site cookies (Vercel frontend + Render API, different domains)
// need SameSite=None + Secure. Same-site local dev (localhost:8443 talking
// to localhost:4000 is same-site — SameSite cares about domain, not port)
// works fine with the friendlier Lax + non-Secure.
const isProd = process.env.NODE_ENV === "production";
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 12 * 60 * 60 * 1000,
  path: "/",
};

// Cost 8, not the more common 10-12: bcryptjs is pure JS (CPU-bound,
// blocks Node's single thread), and this needs to survive 300
// concurrent registrations at once, not resist a decade of offline
// cracking. Cost 8 is still a real, solid bcrypt hash — this is a
// deliberate tradeoff for this threat model (a few hours of hackathon
// traffic), not a security shortcut taken by accident.
const BCRYPT_COST = 8;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifySession(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function setTeamSessionCookie(res, payload) {
  res.cookie(TEAM_COOKIE_NAME, signSession(payload), COOKIE_OPTS);
}

export function setAccountSessionCookie(res, payload) {
  res.cookie(ACCOUNT_COOKIE_NAME, signSession(payload), COOKIE_OPTS);
}

export function setAdminSessionCookie(res, payload) {
  res.cookie(ADMIN_COOKIE_NAME, signSession(payload), COOKIE_OPTS);
}

export function clearSessionCookie(res, cookieName = TEAM_COOKIE_NAME) {
  res.clearCookie(cookieName, { ...COOKIE_OPTS, maxAge: undefined });
}

export function clearTeamSessionCookie(res) {
  clearSessionCookie(res, TEAM_COOKIE_NAME);
}

export function clearAccountSessionCookie(res) {
  clearSessionCookie(res, ACCOUNT_COOKIE_NAME);
}

export function clearAdminSessionCookie(res) {
  clearSessionCookie(res, ADMIN_COOKIE_NAME);
}

export async function requireTeam(req, res, next) {
  const claims = verifySession(req.cookies?.[TEAM_COOKIE_NAME]);
  if (!claims || claims.role !== "team") {
    return res.status(401).json({ error: "Not logged in." });
  }
  try {
    const result = await pool.query(
      `SELECT t.id, t.team_name, t.banned, t.member_count, t.pit_pass_code,
              t.track_id, c.title AS track_title, c.color AS track_color,
              m.id AS member_id, m.member_name, m.is_leader
       FROM teams t
       LEFT JOIN challenges c ON c.id = t.track_id
       LEFT JOIN team_members m ON m.id = $2 AND m.team_id = t.id
       WHERE t.id = $1`,
      [claims.teamId, claims.memberId || null],
    );
    const team = result.rows[0];
    if (!team || team.banned || (claims.memberId && !team.member_id)) {
      clearTeamSessionCookie(res);
      return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    }
    req.team = {
      id: team.id,
      teamName: team.team_name,
      memberId: team.member_id || null,
      memberName: team.member_name || team.team_name,
      isLeader: claims.memberId ? Boolean(team.is_leader) : true,
      memberCount: team.member_count,
      pitPassCode: team.pit_pass_code,
      selectedTrack: team.track_id ? { id: team.track_id, title: team.track_title, color: team.track_color } : null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export async function requireAccount(req, res, next) {
  const claims = verifySession(req.cookies?.[ACCOUNT_COOKIE_NAME]);
  if (!claims || claims.role !== "account") return res.status(401).json({ error: "Account login required." });
  const result = await pool.query("SELECT id, account_name, email, handle, tech_stack, licence_level, role_type FROM accounts WHERE id = $1", [claims.accountId]);
  if (!result.rows[0]) {
    clearAccountSessionCookie(res);
    return res.status(401).json({ error: "Account login required." });
  }
  req.account = {
    id: result.rows[0].id,
    name: result.rows[0].account_name,
    email: result.rows[0].email,
    handle: result.rows[0].handle,
    techStack: result.rows[0].tech_stack,
    licenceLevel: result.rows[0].licence_level,
    roleType: result.rows[0].role_type,
  };
  return next();
}

export function requireAdmin(req, res, next) {
  const claims = verifySession(req.cookies?.[ADMIN_COOKIE_NAME]);
  if (!claims || claims.role !== "admin") {
    return res.status(401).json({ error: "Admin login required." });
  }
  next();
}

// Timing-safe check so a login attempt can't be used to brute-force the
// admin password one character at a time via response-time differences.
export function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
