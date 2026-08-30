# Spec: Secure Admin, Challenge Selection, and Live Synchronization

## Objective

Provide an organizer-only Race Control page at `/admin`, protected by the existing password-backed admin session. It must never appear in normal navigation. Changes made there must appear on the public Challenge and Team pages without a manual refresh. Teams can select multiple challenges, and a team that is banned or removed must lose access immediately and receive an in-app notice when connected.

The registration load test must become safe to run against a disposable database and report a clear pass/fail result without relying on a production-like shared database. The known bcrypt registration latency will be measured and documented rather than weakening password protection further.

## Tech Stack and Commands

- React 19 + Vite frontend in `frontend/`
- Express + PostgreSQL API in `server/`
- Jest + Supertest integration tests in `server/tests/`

```powershell
docker compose up -d db
cd server; npm test
cd frontend; npm run build
cd server; $env:TEAM_COUNT=20; npm run test:load
```

## Project Structure

- `server/migrations/` — additive schema migration for a team's selected challenge.
- `server/src/routes/` — protected selection route, session enforcement, admin events.
- `server/src/live.js` and `server/src/routes/stats.js` — bounded SSE event types and connection-safe delivery.
- `server/tests/integration/` — authorization, selection, revocation, and live-event regression coverage.
- `server/tests/load/` — environment-safe burst script with concurrency and result thresholds.
- `frontend/src/App.tsx` — URL-aware app shell, direct-only admin route, ban/removal notification.
- `frontend/src/pages/` — focused admin, challenge, and team-page data/realtime UI.

## API Contract

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| `GET` | `/api/admin/me` | admin | confirms the current admin session |
| `GET` | `/api/challenges/me` | active team | selected challenges |
| `PUT` | `/api/challenges/me` | active team | replace the team's selected challenges |

Existing admin challenge and team mutations will emit a bounded `data_changed` SSE event. A team ban/removal will additionally emit a targeted `team_access_revoked` event containing only the affected team id and a generic reason. Public clients refresh public data after `data_changed`; only a matching authenticated client acts on the targeted event.

## Authorization and Data Rules

- `/admin` is intentionally undiscoverable from app navigation, but access control remains server-enforced with the admin session.
- Every request protected by `requireTeam` checks that the team still exists and is not banned. The server clears the session cookie and returns a non-sensitive `403` when access is revoked.
- Selections use a `team_challenges` join table. Selecting a missing challenge returns `404`; deleting a challenge removes the affected selections.
- Team selection is not inferred from the UI and is validated on the API boundary.
- Admin login rate limiting, CORS policy, cookie settings, and environment secret handling remain unchanged.

## UI Rules

- Preserve the Circuit Schedule unchanged.
- Replace the SVG-heavy presentation on affected pages with content-first, accessible cards, clear status text, semantic buttons, loading/error/empty states, and responsive layouts.
- Challenge cards show the current team's selected challenges and provide a clear sign-in action when unauthenticated.
- A ban/removal notice uses an accessible modal/status region, clears local team state, and returns the person to the public home page.

## Testing Strategy

- Write failing integration tests before implementation for active-team selection, banned/deleted session rejection, and admin session confirmation.
- Add an SSE-focused test seam that verifies bounded events and subscriber cleanup without holding an unbounded HTTP socket in Jest.
- Keep the production load script from modifying the normal dev database: require an explicit `API_URL` for non-local targets and add a local disposable test target/concurrency control.
- Run all server tests, the frontend production build, a small live burst against the disposable database, and browser verification at 320px, 768px, 1024px, and 1440px.

## Boundaries

- Always: parameterized SQL, Zod input validation, server-side authorization, httpOnly cookie sessions, no secrets in code, and regression tests.
- Ask first: external realtime infrastructure, new dependencies, a change to CORS/rate limits, or keeping a deleted team's record for audit purposes.
- Never: rely on hidden navigation for authorization, expose passwords/session tokens, write load-test records into the normal development database, or alter the Circuit Schedule page.

## Success Criteria

1. Visiting `/admin` is the only normal way to open Race Control; it is absent from header, mobile navigation, and footer.
2. An admin can authenticate with the existing password and manage teams/challenges; public pages reflect those changes live.
3. An active team can choose multiple challenges and see those choices persist across refresh/login.
4. Banned and deleted teams cannot use existing cookies for protected API calls; connected clients receive a clear notice and are logged out.
5. The live event feed stays bounded, cleans up closed subscribers, and public team/challenge data refreshes correctly.
6. The load test has deterministic safeguards and passes its stated threshold against an isolated database; known registration latency is reported separately.
7. Server tests and the frontend production build pass with no new console errors.

## Open Questions

- Teams can select any number of current challenges. Ranked preferences would require a different schema and selection UI.
- “Live load test problem” is treated as both safety (do not flood the active dev database) and observability. The existing report shows successful 300-team runs but ~8-second median registration latency caused by pure-JS bcrypt. A materially faster 300-at-once registration burst would require explicit approval for a native bcrypt/runtime change or a queue.
