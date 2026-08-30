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

const COOKIE_NAMES = {
  team: "team_session",
  member: "member_session",
  admin: "admin_session",
};
const LEGACY_COOKIE_NAME = "session";
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

export function setSessionCookie(res, payload) {
  res.cookie(COOKIE_NAMES[payload.role], signSession(payload), COOKIE_OPTS);
}

export function clearSessionCookie(res, role) {
  if (Array.isArray(role)) role.forEach((name) => res.clearCookie(COOKIE_NAMES[name], { ...COOKIE_OPTS, maxAge: undefined }));
  else if (role) res.clearCookie(COOKIE_NAMES[role], { ...COOKIE_OPTS, maxAge: undefined });
  else Object.values(COOKIE_NAMES).forEach((name) => res.clearCookie(name, { ...COOKIE_OPTS, maxAge: undefined }));
  res.clearCookie(LEGACY_COOKIE_NAME, { ...COOKIE_OPTS, maxAge: undefined });
}

export async function requireTeam(req, res, next) {
  const claims = verifySession(req.cookies?.[COOKIE_NAMES.team]);
  if (!claims || claims.role !== "team") {
    return res.status(401).json({ error: "Not logged in." });
  }
  try {
    const result = await pool.query(
      `SELECT t.id, t.team_name, t.description, t.logo_url, t.banned,
              m.id AS member_id, m.display_name, m.role AS member_role
       FROM teams t
       LEFT JOIN members m ON m.id = $2 AND m.team_id = t.id
       WHERE t.id = $1`,
      [claims.teamId, claims.memberId || null],
    );
    const team = result.rows[0];
    if (!team || team.banned || (claims.memberId && !team.member_id)) {
      clearSessionCookie(res, "team");
      return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    }
    req.team = {
      id: team.id,
      teamName: team.team_name,
      description: team.description,
      logoUrl: team.logo_url,
      memberId: team.member_id,
      memberName: team.display_name,
      memberRole: team.member_role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export async function requireMember(req, res, next) {
  const claims = verifySession(req.cookies?.[COOKIE_NAMES.member]);
  if (!claims || claims.role !== "member") {
    return res.status(401).json({ error: "Member login required." });
  }
  try {
    const result = await pool.query(
      `SELECT m.id, m.display_name, m.email, m.team_id, m.role,
              t.team_name, t.description, t.logo_url, t.banned AS team_banned
       FROM members m
       LEFT JOIN teams t ON t.id = m.team_id
       WHERE m.id = $1`,
      [claims.memberId],
    );
    const member = result.rows[0];
    if (!member) {
      clearSessionCookie(res, "member");
      return res.status(401).json({ error: "Member login required." });
    }
    req.member = {
      id: member.id,
      displayName: member.display_name,
      email: member.email,
      teamId: member.team_id,
      role: member.role,
      team: member.team_id && !member.team_banned
        ? { id: member.team_id, teamName: member.team_name, description: member.description, logoUrl: member.logo_url }
        : null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireLeader(req, res, next) {
  if (!req.team?.memberId || req.team.memberRole !== "leader") {
    return res.status(403).json({ error: "Team leader access is required." });
  }
  return next();
}

export function requireAdmin(req, res, next) {
  const claims = verifySession(req.cookies?.[COOKIE_NAMES.admin]);
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
