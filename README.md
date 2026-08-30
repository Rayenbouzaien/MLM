# Gridlock — Formula 1 Hackathon Platform

Gridlock is a full-stack hackathon platform for teams, challenge selection, submissions, and secure organizer operations.

## Quick start

```powershell
docker compose up -d db adminer

cd server
npm install
npm start

# Open a second terminal
cd frontend
npm install
npm run dev
```

- Website: http://localhost:8443
- Admin dashboard: http://localhost:8443/admin
- API health: http://localhost:4000/api/health
- Database viewer: http://localhost:8081

## Local development credentials

These are **local Docker development defaults only**. Change them before any deployment and never reuse them for a public database.

| Service | Value |
| --- | --- |
| Admin dashboard password | `dev-admin-pass` |
| PostgreSQL username | `postgres` |
| PostgreSQL password | `devpassword` |
| PostgreSQL database | `gridlock` |
| Adminer server field | `db` |

## Useful commands

```powershell
# Backend tests (uses the isolated gridlock_test database)
cd server
npm test

# Frontend production build
cd frontend
npm run build

# Live burst test against a running API
cd server
npm run test:load

# Run a smaller controlled burst
$env:TEAM_COUNT=20; $env:MAX_CONCURRENCY=5; npm run test:load
```

## Features

- Direct-only, password-protected Race Control dashboard at `/admin`
- Admin challenge CRUD and team creation, suspension, and removal
- Multiple saved challenge selections for each team
- Server-side invalidation of banned or deleted team sessions
- Live Paddock and challenge-board updates through Server-Sent Events
- Concurrent registration and submission load testing with PostgreSQL pooling

## Project layout

- `frontend/` — React and Vite application
- `server/` — Express API, migrations, and test suites
- `docs/` — implementation specifications and decisions
