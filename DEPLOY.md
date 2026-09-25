# Deploy MedCounsel (free on Render)

## After GitHub push

1. Go to [render.com](https://render.com) → sign in with GitHub
2. **New +** → **Blueprint** → select repo `medcounsel` → Apply
3. Set these env vars when prompted (or in Render → Environment):

| Variable | Example |
|----------|---------|
| `AUTH_URL` | `https://medcounsel.onrender.com` (your exact Render URL) |
| `ALLOWED_USERS` | `email\|Name\|USER,admin@email.com\|Admin\|ADMIN` |
| `AUTH_DEFAULT_PASSWORD` | strong password (for re-seed only; copied DB keeps existing logins) |

4. Wait for deploy (~5–10 min). Open `/login`.

## Client login

Share the Render URL + email/password from your seeded users.

## Update data later

Replace `packages/database/prisma/prod.db` locally, commit, push — Render redeploys.
