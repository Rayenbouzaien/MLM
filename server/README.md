# Gridlock API (Express + PostgreSQL + Redis)

Stateless HTTP API for the Gridlock hackathon platform: team accounts,
challenges, submissions, admin dashboard and a live Server-Sent-Events feed.
Designed to run as **N identical replicas** behind a load balancer.

> Container / Kubernetes deployment: see the repository root `README.md`.

## Configuration (environment variables)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | Session signing secret (16+ chars) |
| `ADMIN_PASSWORD` | yes | — | `/admin` dashboard password (8+ chars) |
| `REDIS_URL` | no | unset | Enables the shared live feed across replicas |
| `PGSSL` | no | TLS on | `false` for an in-cluster / local Postgres |
| `PGPOOL_MAX` | no | `15` | Max DB connections **per replica** |
| `ALLOWED_ORIGINS` | no | allow all | Comma-separated CORS allow-list |
| `COOKIE_SECURE` | no | `false` | `true` when served over HTTPS |
| `COOKIE_SAMESITE` | no | `lax` | `none` only for cross-site frontends |
| `TRUST_PROXY` | no | `1` | Reverse-proxy hops to trust for client IPs |
| `PORT` | no | `4000` | Listen port |

## Why it survives a burst of concurrent submissions

Each process keeps one small `pg.Pool` (`PGPOOL_MAX`) and reuses it; extra
requests queue in memory instead of opening new connections. Total load on
Postgres is `replicas x PGPOOL_MAX`, so keep it under `max_connections`
(100 by default). Submissions are idempotent (upsert by team), so a retry
never creates duplicates.

## Running several replicas safely

- **Migrations** run at boot inside a Postgres advisory lock
  (`src/db.js`), so replicas starting together apply them one after another.
- **Live feed** goes through Redis pub/sub when `REDIS_URL` is set.
- **Sessions** are signed JWT cookies: no server-side session state, any
  replica can serve any request.
- `GET /api/health` returns the answering replica's hostname, which makes
  load balancing visible.

## Run the tests

Needs a local PostgreSQL with a `gridlock_test` database (credentials in
`.env.test`, default `postgres` / `devpassword` on `localhost:5432`):

```
docker run -d --name pg-test -e POSTGRES_PASSWORD=devpassword -p 5432:5432 postgres:16-alpine
docker exec pg-test createdb -U postgres gridlock_test
cd server && npm ci && npm test        # 60 tests
```

Load test against a running stack (compose publishes the UI on :8080):

```
API_URL=http://localhost:8080 npm run test:load
TEAM_COUNT=50 MAX_CONCURRENCY=10 API_URL=http://localhost:8080 npm run test:load   # lighter run
```

See `TEST_REPORT.md` for the original results and the bugs the load test caught.

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
| GET | `/api/health` | — | Liveness: status, pool stats, `instance` (hostname of the replica that answered), `live` (`redis`/`memory`). |
| GET | `/api/ready` | — | Readiness: `200` only if the database answers (`SELECT 1`), else `503`. |

"team"/"admin" auth = an httpOnly session cookie set by the matching
login endpoint; the browser sends it automatically because nginx serves the UI and the API from the same origin.

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

- **Live feed needs Redis to scale out.** Without `REDIS_URL`, `/api/live`
  uses an in-process bus (single API process only). With it, every replica
  publishes/subscribes on the same Redis channel (see `src/live.js`).
- **Single shared admin account**, not per-organizer accounts.
- **No password reset flow.** A team that forgets its password needs an
  organizer to delete it and re-register, or a manual DB fix.
- **Postgres is a single primary** (one StatefulSet pod). The stateless API
  scales horizontally; the database does not (no replication configured).
