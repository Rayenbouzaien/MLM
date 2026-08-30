# Test Report — Gridlock Hackathon Platform

## v2 update: auth, admin, challenges, live feed

Everything below the "v1" section is unchanged and still holds. This
section covers what changed when team accounts, admin management,
challenges, and a live feed were added.

**43/43 backend tests passing** (up from 29 — 14 new tests for auth,
admin, and challenges). Frontend builds clean (`vite build`, zero
errors). Full end-to-end flow re-verified live: register → submit →
public roster updates → admin login → create challenge → ban team →
banned team's login correctly rejected → live feed reflects it all in
real time — all through real cross-origin requests matching how the
deployed Vercel+Render split will actually behave.

### Bug caught during this round
`ON CONFLICT (team_id)` failed with `there is no unique or exclusion
constraint matching the ON CONFLICT specification` — the migration's
unique index was accidentally partial (`WHERE team_id IS NOT NULL`), and
`ON CONFLICT` can't infer a partial index without repeating its exact
predicate. Fixed by dropping the predicate — Postgres already treats
NULLs as distinct in a unique index, so it wasn't needed. Caught
immediately by manually exercising the submit flow before trusting it
to automated tests, same as the v1 rate-limiter bug.

### Security decisions worth knowing about
- **Closed a real hole from v1**: submissions used to be keyed by
  free-text `teamName` sent in the request body — anyone could type
  another team's name and overwrite their submission. Now identity comes
  only from a signed session cookie. Directly tested (`tests/integration/submissions.test.js`:
  "one team cannot see or overwrite another team's submission").
- Passwords are bcrypt-hashed (cost 10), never stored or logged in
  plaintext — tested by asserting the stored hash doesn't match the
  input and matches bcrypt's `$2a/b/y$` shape.
- Login failure messages are identical whether the team doesn't exist or
  the password is wrong, so the endpoint can't be used to enumerate
  registered team names.
- Admin login uses a stricter rate limit (20/15min) than team
  auth/submissions (1000/10min) — deliberately: one shared admin account
  is a much higher-value brute-force target than any individual team's,
  while 300 teams sharing one venue IP still need the generous ceiling
  (see the v1 section below for why that number is what it is).
- Admin password comparison uses `crypto.timingSafeEqual`, not `===`, so
  response timing can't be used to guess it character-by-character.
- Both `JWT_SECRET` and `ADMIN_PASSWORD` are required at boot — the
  server refuses to start without them rather than falling back to a
  guessable default.

### Load test: registration burst caught two real problems

The live `tests/load/burst-submit.js` script now simulates the realistic
flow (register + submit per team, 300 teams concurrent) instead of just
submissions. First run against the real feature set found two genuine
issues:

```
Register status breakdown: { '201': 197, '429': 100, '503': 3 }
Register latency p50: 15235ms
```

1. **Rate limiter too tight** — the auth endpoints were left at 200
   requests/10min, the same shared-venue-IP mistake as the v1 submission
   limiter, just not caught before because auth didn't exist yet in v1.
   Fixed: raised to 1000, matching submissions.
2. **bcrypt is genuinely CPU-expensive at scale** — `bcryptjs` is pure
   JS (no native binding, deliberately, for Docker/Alpine portability)
   and hashing is CPU-bound, so it blocks Node's single thread. 300
   concurrent hashes at cost-factor 10 serialize badly. Fixed: lowered
   to cost-factor 8 — still a solid, real bcrypt hash, just tuned for
   "survive 300 concurrent registrations in a few hours" rather than
   "resist a decade of offline cracking." That's a deliberate tradeoff
   for this threat model, not an accidental weakening.

Re-tested after both fixes:
```
Register status breakdown: { '201': 300 }
Submit status breakdown: { '200': 300 }
Register latency p50: 7834ms, submit latency p50: 818ms
```

**Honest caveat left in place:** registration is still ~8s at the
absolute worst case of all 300 teams registering in the same
millisecond. Unlike submissions (which have a hard synchronized
deadline — everyone really does click Submit near the same second),
registration naturally spreads out as teams arrive at the event, so
this residual latency is a UX quality note, not a correctness or
crash risk — every request still succeeds. If registration ever needs
to be instant at that same instant-burst scale, the next step would be
native bcrypt (requires a non-Alpine or build-tooled image) or moving
hashing off the request path into a queue.

### Coverage added
- Register: creates account, sets cookie, rejects duplicate names
  (case-insensitively), rejects short passwords, never stores plaintext
- Login: correct/wrong password, nonexistent team, banned team blocked
- Session: `/me` requires auth, logout actually invalidates the cookie
- Submissions: unauthenticated rejected, cross-team isolation, upsert
  idempotency, 20-concurrent-from-one-team still dedupes to 1 row
- Admin: wrong/right password, every challenge CRUD op requires admin,
  invalid hex color rejected, team list/ban/delete, ban cascades to
  blocking login, delete cascades to removing their submission

### What's still not covered
- SSE (`/api/live`) has no automated test — verified manually via curl
  (`tests/integration` doesn't have a good pattern for long-lived
  streaming connections without added tooling). Manually confirmed it
  replays recent history to new connections and pushes live events.
- No test exercises the frontend in an actual browser (no headless
  browser tooling in this environment) — verified instead by building
  with `vite build` and confirming every module transforms/serves
  correctly, plus tracing the full request flow via curl with real
  `Origin` headers matching the browser's cross-origin behavior.

---

# v1 report (original submission-burst testing)

Tested against a real local PostgreSQL 16 instance (not mocks) and a
live running server process for load tests, so these results reflect
actual behavior, not just code that looks right.

## Scope

| Layer | Tool | What it proves |
|---|---|---|
| Unit | Jest | Validation schema handles good/bad input correctly, in isolation |
| Integration | Jest + Supertest + real Postgres | API + DB behave correctly together: upserts, uniqueness, auth, 404s |
| Load / Concurrency | Node script hitting a live server | The actual thing this project exists to prove: it survives a burst |

## Bug found: rate limiter would have blocked ~90% of a real hackathon burst

**Severity: Critical**

The first version of the submission endpoint rate-limited to 30 requests /
5 minutes **per IP**. Load-testing it with the realistic scenario —300
concurrent submissions — surfaced the problem immediately:

```
Status code breakdown: { '200': 30, '429': 270 }
30/300 requests succeeded (10.0%)
```

**Root cause:** hackathons are usually in-person events. 300 teams on the
same venue WiFi / office NAT all present as a single public IP to the
server. A per-IP limit tuned for "one person spamming" instead throttled
"everyone in the room submitting at once" — the exact scenario this
project is supposed to handle.

**Fix:** raised the limit to 1000 requests / 10 minutes per IP (this
carried forward into v2's submission endpoint unchanged). Re-tested
after the fix:

```
Status code breakdown: { '200': 300 }
300/300 requests succeeded (100.0%)
```

## Load test evidence (v1, still representative of the pooling layer)

| Scenario | Requests | Result | Wall time | p95 latency |
|---|---|---|---|---|
| Target load: 300 unique teams, single burst | 300 | **300/300 succeeded** | 1.0s | 938ms |
| Double-click noise: 300 teams × 2 clicks each | 600 | **600/600 succeeded**, DB confirms exactly 300 rows / 300 distinct teams | 1.7s | 1540ms |
| Stress beyond scope: 1500 unique teams | 1500 | 100 succeeded, 1400 cleanly rejected with 429 (no 500s, no crash) | 2.4s | 2018ms |
| Pool-starvation test: 300 requests through a pool of only **3** connections | 300 | **300/300 succeeded** (proves queuing, not luck, handles the burst) | 0.9s | 807ms |

`tests/load/burst-submit.js` now needs an authenticated cookie to hit
`/api/submissions` (v2 requires login) — see the script's usage comment
for the updated invocation with a registered team's session cookie.

