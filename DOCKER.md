# Running the full app locally with Docker Desktop

One command spins up Postgres, the API, and the React frontend together —
no local Postgres install, no local Node version wrangling, nothing
manual to wire up.

```
gridlock/
├── docker-compose.yml
├── .env.example
├── server/            # backend API
│   ├── Dockerfile
│   └── ...
└── frontend/           # React + Vite app
    ├── Dockerfile
    └── ...
```

This has been verified end-to-end in a Linux sandbox using the exact
config values Docker Compose injects (build, boot, CORS preflight, and a
real POST /api/submissions call from the frontend's origin all succeeded)
— Docker itself wasn't available there to run `docker compose up`
literally, so **your `docker compose up --build` is still the real first
run**, but this isn't a first-time-untested setup.

## 1. Set up env vars

```
cp .env.example .env
```

Defaults work as-is for local dev. `JWT_SECRET` and `ADMIN_PASSWORD` are
now required — the API refuses to boot without them (fail-fast, not a
silent insecure default). The `.env.example` defaults are fine for local
use; **generate real ones before deploying anywhere public**:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
`ADMIN_PASSWORD` is what you type into the "Race Control" admin login in
the app (footer link) — pick something real, not the dev default, once
this isn't just running on your own machine.

**Correction from earlier in this conversation:** I'd said the frontend
runs on Vite's generic default port, 5173. It doesn't — this project's
`vite.config.ts` hardcodes port **8443** by default. `docker-compose.yml`
and `.env.example` both use 8443 now.

## 2. Start everything

Open Docker Desktop (just needs to be running), then from the folder
containing `docker-compose.yml`:

```
docker compose up --build
```

First run takes a few minutes — pulling `postgres:16-alpine`, `pnpm
install` for the frontend, `npm install` for the API. After that it's
fast. Startup order is enforced by health checks, not guesswork:
`db` must report healthy before `api` starts, and `api` must report
healthy before `web` starts — so you won't hit "frontend loaded before
the API was ready" style races.

## 3. Open it

- **Frontend:** http://localhost:8443
- **API health:** http://localhost:4000/api/health → `{"status":"ok",...}`
- **Adminer** (DB browser, included for convenience, localhost-only —
  see security note below): http://localhost:8081
  — System: PostgreSQL, Server: `db`, Username: `postgres`, Password:
  your `POSTGRES_PASSWORD` (default `devpassword`), Database: `gridlock`

Go to the Garage page in the browser, fill in a GitHub link, hit Submit —
it should flip to "✓ INNOVATION SUBMITTED". If it doesn't, open the
browser's dev tools Network tab first; almost every issue at this stage
shows up there (see Troubleshooting).

## Everyday commands

| Command | What it does |
|---|---|
| `docker compose up` | Start everything (build only if needed) |
| `docker compose up --build` | Force a rebuild (needed after changing `package.json` in either service) |
| `docker compose up -d` | Start in the background |
| `docker compose logs -f web` | Tail just the frontend's logs |
| `docker compose logs -f api` | Tail just the API's logs |
| `docker compose down` | Stop everything, keep the DB data |
| `docker compose down -v` | Stop everything **and delete** the DB volume (fresh start) |

## Live editing

- **Frontend:** `web`'s source is bind-mounted (`./frontend:/app`), so
  editing files on your host triggers Vite's normal hot reload — no
  rebuild needed. `node_modules` uses a separate anonymous volume so the
  container's own install doesn't get shadowed by your host folder.
- **Backend:** `api` is NOT live-mounted — it's a static build, so code
  changes need `docker compose up --build`. Ask if you want this converted
  to a live-reload setup too (Node's built-in `--watch` flag would do it).

## Running the automated backend tests against this

The Jest suite runs on your host, not inside Docker, and needs its own
throwaway database (kept separate from the `gridlock` dev DB on purpose).
Since Compose exposes Postgres on `localhost:5432`:

```
docker exec -it $(docker compose ps -q db) psql -U postgres -c "CREATE DATABASE gridlock_test;"
```
then edit `server/.env.test`'s password to match your `POSTGRES_PASSWORD`
(default `devpassword`, not the `testpass` it ships with), and run
`npm test` from `server/` as usual. `npm run test:load` works the same
way against `http://localhost:4000` once everything's up.

## Security note: Adminer and Postgres are localhost-only, on purpose

`db` (port 5432) and `adminer` (port 8081) are bound to `127.0.0.1` only
in `docker-compose.yml`, not `0.0.0.0` — meaning only your own machine can
reach them, not other devices on the same WiFi. This matters more than it
might seem: Adminer has no login of its own (just whatever Postgres
password you set, and the dev default here is weak), has an actual CVE
history (SSRF, XSS, and a 2025 unauthenticated DoS bug — CVE-2025-43960 —
in the version this image likely pulls), and the upstream project is no
longer actively maintained (a fork, AdminerEvo, has taken over fixing new
issues). At an in-person hackathon on shared venue WiFi, an unrestricted
Adminer would be reachable by anyone else on that network.

`api` and `web` stay open on all interfaces since you may want to pull
the app up on a phone for testing — those have real auth/validation in
front of them (rate limiting, input validation, an admin token), unlike
Adminer and raw Postgres.

If you don't need Adminer at all, delete its whole block from
`docker-compose.yml` — nothing else depends on it.

## Troubleshooting

- **`db` fails immediately** — port 5432 already in use by a local
  Postgres install. Stop that service, or remap the host port in
  `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL`.
- **`adminer` fails with a port-binding error** (`ports are not
  available: ... 8080 ...` or, on Windows, "Only one usage of each socket
  address is normally permitted") — something else on your machine is
  already using that port (common culprits: another dev tool, or Windows'
  own service reservations). The compose file now maps it to host port
  **8081** instead of 8080 for exactly this reason. If 8081 is also taken,
  change the left-hand side of `adminer`'s `ports:` line to any free port.
  Since Adminer is just a convenience DB browser, you can also delete its
  whole block from `docker-compose.yml` if you don't want it at all — it
  won't affect `db`, `api`, or `web`.
- **`api` keeps restarting** — `docker compose logs api`; almost always a
  `DATABASE_URL` mismatch. From inside the `api` container, the DB's
  hostname is `db` (the Compose service name), not `localhost`.
- **`web` builds but the page can't reach the API / CORS errors in the
  browser console** — check that `ALLOWED_ORIGINS` in `.env` matches
  exactly what the browser shows in its address bar (including port).
  Trailing slashes or `127.0.0.1` vs `localhost` mismatches will trip
  this, since CORS origin matching is exact-string.
- **Changed `server/` code, don't see it reflected** — that service isn't
  live-mounted; run `docker compose up --build`.
