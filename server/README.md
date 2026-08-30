# Gridlock Hackathon Submission API

Handles concurrent challenge submissions (GitHub link required, Google Drive
link optional) without falling over when everyone hits Submit at once.

## Why this doesn't crash at 300 concurrent submissions

The classic failure mode: each incoming request opens its own Postgres
connection. Postgres defaults to ~100 max connections total. 300 simultaneous
requests each trying to open a fresh connection blows past that instantly and
everything errors out.

This service avoids that in two layers:

1. **App-level pooling** — `src/db.js` opens one small `pg.Pool` (default
   15 connections) when the process boots and reuses it for every request.
   Requests beyond 15 concurrent don't error — `pg.Pool` queues them
   in memory and serves each as a connection frees up (a single Postgres
   insert takes a few milliseconds, so the queue drains fast).
2. **DB-level pooling (Neon)** — point `DATABASE_URL` at Neon's *pooled*
   connection string (hostname has `-pooler` in it). That runs PgBouncer
   in front of Postgres, multiplexing many logical connections onto a
   much smaller number of real backend connections. This is what protects
   you if you ever scale the API to multiple instances.

On top of that: submissions are **idempotent** (upsert by team name), so a
double-click or a retried request after a timeout updates the same row
instead of creating duplicates or throwing a unique-violation error.

## 0. Run the tests first

This has been tested end-to-end against a real Postgres instance and a
live server process — see `TEST_REPORT.md` for the full results,
including a real bug (rate limiter blocking 90% of a legitimate burst)
that load-testing caught and that's now fixed.

```
cd server
npm install
npm test              # 29 unit + integration tests against a local Postgres
npm start &           # in one terminal
npm run test:load      # in another — fires 300 concurrent submissions at it
```

You'll need a local Postgres for `npm test` (the tests point at
`.env.test`, which expects `postgresql://postgres:testpass@localhost:5432/gridlock_test`
— create that DB and user, or edit `.env.test` to match whatever you have
locally). Once Neon/Render are live, also run:
```
API_URL=https://your-service.onrender.com npm run test:load
```
to sanity-check the real deployment before the event — Neon's pooler and
Render's network add latency this local test can't see.

## 1. Set up Neon (free Postgres)

1. Create a project at neon.tech.
2. In the dashboard, copy the **pooled** connection string (not the direct
   one) — it contains `-pooler` in the hostname.
3. You don't need to run the migration by hand; the server runs
   `migrations/001_init.sql` automatically on boot (`CREATE TABLE IF NOT
   EXISTS`, safe to run repeatedly). You can also run it manually:
   ```
   DATABASE_URL="..." npm run migrate
   ```

## 2. Deploy to Render (free Web Service)

1. Push this `server/` folder to a GitHub repo (its own repo, or a
   subfolder of your existing one).
2. On Render: **New → Web Service** → connect the repo.
   - Root directory: `server` (if it's a subfolder)
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables (Render dashboard → Environment):
   - `DATABASE_URL` — the Neon pooled string
   - `ALLOWED_ORIGINS` — your Vercel URL, e.g. `https://your-app.vercel.app`
   - `JWT_SECRET` — 16+ random chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_PASSWORD` — 8+ chars, this is your real admin login password
   - `PGPOOL_MAX` — `15` is a good starting point
4. Deploy. Check `GET https://your-service.onrender.com/api/health`.

**Free-tier caveat:** Render's free web services spin down after ~15 minutes
of no traffic, and the next request pays a cold-start penalty (can be
10-30+ seconds). For a hackathon submission window, keep it warm during the
event by pinging `/api/health` every 5-10 minutes (a free
[UptimeRobot](https://uptimerobot.com) monitor works well) for the couple of
hours around your deadline.

## 3. Point the frontend at it

In your Vercel project's environment variables, set:
```
VITE_API_URL=https://your-service.onrender.com
```
(See the updated `GaragePage.tsx` — it reads this and falls back to
`http://localhost:4000` for local dev.)

## 4. Load-test before the real deadline

Don't find out it holds up under load during the actual event. With
[k6](https://k6.io) (free, no signup):

```js
// loadtest.js — register a fresh team per virtual user, then submit,
// since /api/submissions now requires a real logged-in team.
import http from 'k6/http';
export const options = { vus: 300, duration: '20s' };
export default function () {
  const jar = http.cookieJar();
  http.post('https://your-service.onrender.com/api/auth/register', JSON.stringify({
    teamName: `Load Test Team ${__VU}-${__ITER}`,
    password: 'loadtestpassword123',
  }), { headers: { 'Content-Type': 'application/json' } });
  http.post('https://your-service.onrender.com/api/submissions', JSON.stringify({
    githubUrl: 'https://github.com/octocat/Hello-World',
  }), { headers: { 'Content-Type': 'application/json' }, jar });
}
```
```
k6 run loadtest.js
```
Or just use the included `tests/load/burst-submit.js` (`npm run test:load`),
which already does this register+submit pattern and prints a full latency
breakdown — no k6 install needed.

This fires 300 virtual users at the endpoint continuously for 20s — a
harder test than "everyone submits in the same second." Watch
`/api/health`'s `pool.waiting` while it runs; sustained high values mean
raise `PGPOOL_MAX` (and your Neon plan's connection limit if needed).

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ teamName, password }`. Creates account, sets session cookie. |
| POST | `/api/auth/login` | — | `{ teamName, password }`. |
| POST | `/api/auth/logout` | — | Clears session. |
| GET | `/api/auth/me` | team | Current session info. |
| POST | `/api/submissions` | team | `{ githubUrl, driveUrl? }`. Upserts the caller's own submission. |
| GET | `/api/submissions/me` | team | The caller's own submission. |
| GET | `/api/challenges` | — | Public list. |
| POST/PATCH/DELETE | `/api/challenges[/:id]` | admin | Manage challenges. |
| POST | `/api/admin/login` | — | `{ password }`. |
| GET | `/api/admin/teams` | admin | All teams + submission status. |
| PATCH | `/api/admin/teams/:id/ban` | admin | `{ banned: boolean }`. |
| DELETE | `/api/admin/teams/:id` | admin | Removes team + their submission. |
| GET | `/api/stats` | — | `{ team_count, submission_count }`. |
| GET | `/api/teams` | — | Public roster (name + submitted status, banned teams excluded). |
| GET | `/api/live` | — | Server-Sent Events stream of join/submit activity. |
| GET | `/api/health` | — | Status + live pool stats. |

"team"/"admin" auth = an httpOnly session cookie set by the matching
login endpoint; requests need `credentials: "include"` cross-origin.

## Security notes

- Passwords are bcrypt-hashed (cost 8 — see `TEST_REPORT.md` for why not
  the more common 10-12: pure-JS bcrypt is CPU-bound and needs to survive
  300 concurrent registrations, not resist a decade of offline cracking).
- Sessions are signed JWTs in httpOnly cookies — `JWT_SECRET` must be set
  or the server refuses to boot.
- Login responses don't reveal whether a team name exists (same error for
  wrong password vs. no such team).
- Admin password comparison is timing-safe (`crypto.timingSafeEqual`).
- One team cannot read or overwrite another team's submission — identity
  comes from the session, never from anything in the request body.

## Known limitations

- **Live feed is single-instance only.** `/api/live` uses in-process
  pub-sub (see `src/live.js`). Fine for one Render web service; if this
  ever runs as multiple instances, events won't cross processes —
  upgrade to Postgres `LISTEN/NOTIFY` or Redis pub-sub then.
- **Single shared admin account**, not per-organizer accounts. Fine for
  one team of organizers sharing one password; if you need per-person
  admin logins with an audit trail, that's a bigger piece of work.
- **No password reset flow.** A team that forgets their password needs
  an organizer to delete and let them re-register, or a manual DB fix.
