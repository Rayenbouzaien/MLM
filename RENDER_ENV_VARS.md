# Render Environment Variables Checklist

This file documents the environment variables that **MUST** be set in your Render service dashboards (not in docker-compose.yml).

## Critical Fixes Applied

✅ **Bug #1 Fixed**: `frontend/Dockerfile` already runs production build + preview
✅ **Bug #2 Fix Required**: Backend service must set `NODE_ENV=production`
✅ **Vite Config Fixed**: Added `allowedHosts: true` to allow Render's proxy headers

---

## Backend Service (`mlm-backend-5j0n.onrender.com`)

Set these in Render Dashboard → Your Backend Service → Environment:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://mlm_db_9vz9_user:7cngWFIXCpTlJadVgokQfYIVZDZo5Hfi@dpg-dabttdon74is738fb11g-a/mlm_db_9vz9` | **Critical**: Full connection string with credentials |
| `PGSSL` | `true` | **Changed from `false`** — external DB requires SSL |
| `ALLOWED_ORIGINS` | `https://mlm-ei66.onrender.com` | **Must match** your deployed frontend URL exactly (no trailing slash) |
| `JWT_SECRET` | `17156c7d1067769db2080cad95236d4ffd4de64146f034735d6cf9717fb20765` | 32-char hex string (or generate new: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `ADMIN_PASSWORD` | `$!Ies?whk:0$Utw` | **Critical**: 8+ chars, set for real |
| `NODE_ENV` | `production` | **ROOT CAUSE #2**: Enables secure cookies + SameSite=None for cross-origin session persistence |
| `PGPOOL_MAX` | `15` | Connection pool size |
| `PORT` | `4000` | Default port (may be auto-set by Render) |

### Verification

After setting `NODE_ENV=production`, verify in Render logs:
```
curl https://mlm-backend-5j0n.onrender.com/api/health
```

Should return `{"status":"ok"}` with Set-Cookie headers.

---

## Frontend Service (`mlm-ei66.onrender.com`)

Set these in Render Dashboard → Your Frontend Service → Environment (build-time):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://mlm-backend-5j0n.onrender.com` | **Build-time env var** — baked into the static build; cannot be changed at runtime |
| `PORT` | `8443` | Expose port (may be auto-set by Render) |

### Important

- `VITE_API_URL` **must be set during the build** (Vite embeds it in the static JS bundle)
- If you change the backend URL later, redeploy the frontend service to rebuild
- The frontend/Dockerfile now runs `pnpm build` then `pnpm preview` (production mode)

---

## Cross-Origin Session Fix (ROOT CAUSE #2)

**Why admin login was breaking:**

1. Frontend: `https://mlm-ei66.onrender.com`
2. Backend: `https://mlm-backend-5j0n.onrender.com`
3. These are **different subdomains** → **cross-origin** by browser policy
4. Without `NODE_ENV=production`, cookies default to `SameSite=Lax; Secure=false`
5. Browsers silently DROP `SameSite=Lax` cookies on cross-origin requests
6. Result: Admin login "succeeds" (POST returns 200) but next request has no cookie → looks logged-out

**With `NODE_ENV=production`:**
- Cookies sent as `SameSite=None; Secure=true` (Render uses HTTPS)
- Browsers allow these cookies on cross-origin fetch()
- Session persists across requests ✅

See: `server/src/auth.js` lines 27–31 for the logic.

---

## Deployment Checklist

1. ✅ Backend: Add `NODE_ENV=production` → Redeploy
2. ✅ Frontend: Set `VITE_API_URL=https://mlm-backend-5j0n.onrender.com` → Redeploy
3. ✅ Frontend Dockerfile already correct (`pnpm build` + `pnpm preview`)
4. ✅ Vite config updated (`allowedHosts: true` in server block)
5. ✅ `.env` file removed from git history

After both services redeploy:
- Test admin login at `https://mlm-ei66.onrender.com/admin`
- Check Network tab in browser DevTools — should see Set-Cookie headers
- Check browser DevTools → Application → Cookies — should persist `admin_session` cookie

---

## If Still Broken

Paste these from the Render dashboard Logs:

**Backend logs:**
- Any errors during startup (should see "listening on :4000")
- Any "Blocked request" messages from Postgres

**Frontend logs:**
- Browser console (Ctrl+Shift+K) for any errors
- Network tab for failed requests to the backend

---

## Local Development (docker-compose.yml)

Your local `docker-compose.yml` is unchanged and correct for dev:
- Uses local Postgres container
- `VITE_API_URL=http://localhost:4000`
- `NODE_ENV` defaults to undefined (Vite dev server safe)
- Cookies default to `SameSite=Lax` (same-origin, no problem)

Just run: `docker compose up`
