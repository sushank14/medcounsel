# MedCounsel AI — Codebase Audit & Production Readiness (2026-11-03)

Repository: [github.com/sushank14/medcounsel](https://github.com/sushank14/medcounsel)  
Live: [medcounsel.onrender.com](https://medcounsel.onrender.com/)

This report reflects an incremental audit and improvement pass **without rebuilding the application from scratch**.

---

## 1. Architecture summary

| Layer | Location | Role |
|--------|----------|------|
| Frontend | `apps/web` | Next.js 15 App Router, My Chances, counselling hub, admin |
| APIs | `apps/web/app/api/*` | Predictions, profile, preferences, Maharashtra rank tools, admin |
| Orchestration | `apps/web/lib/predictions.ts` | Prisma queries, MAH/MCC separation, fit + confidence |
| Prediction math | `packages/prediction-engine` | `classifyFit`, statistics, confidence, backtest helpers |
| Database | `packages/database` | Prisma + SQLite (`prod.db` on Render) |
| Ingestion | `packages/data-ingestion` | MCC/MH PDF parsers, import CLIs, MH 2025 pipeline |
| Python MH | `packages/data-ingestion/python/maharashtra` | Download, extract, validate, matrix compare |
| Shared types | `packages/types` | `PredictionResult`, labels, disclaimers |

**Data flow:** Official PDFs → parsers → JSON/processed → import scripts → SQLite → `generatePredictions()` → UI cards.

---

## 2. Problems discovered (prioritized)

| Severity | Issue | Status |
|----------|--------|--------|
| Critical | Admin + `/api/admin/import` open to all guests when auth disabled | **Fixed** — admin requires `ADMIN` role in production; `ADMIN_DEV_OPEN` local only |
| Critical | AIR compared to SML cutoffs when no exact AIR↔SML match | **Fixed** — predictions use `lookupByAirExact`; STATE-only returns empty + API warning |
| Critical | Interpolated SML used for Maharashtra fit | **Fixed** — interpolation UI-only |
| High | Forensic Medicine merged into General Medicine (MH cutoffs) | **Fixed** (prior commit + sanity test) |
| High | No CI | **Fixed** — `.github/workflows/ci.yml` |
| High | Web `exec()` imports on Render | **Mitigated** — blocked in production unless `ALLOW_WEB_IMPORT=true` |
| Medium | MS course filter + hidden MD branch prefs → zero results | **Fixed** (prior commit) |
| Medium | Misleading “OFFICIAL MCC” on MH rows | **Fixed** (prior commit) |
| Medium | SQLite on Render — user data ephemeral unless `prod.db` committed | **Documented** — see `DEPLOY.md` |
| Medium | Guest user shared profile/preferences | Open |
| Low | No Playwright e2e | TODO |
| Low | R2 MH allotment PDF not in manifest | TODO — fetch from portal |
| Low | OCR fallback for PDFs | Not implemented |
| Low | Full category set (VJ, NT, SBC seat-level) | Partial in parsers |

---

## 3. Features improved (this pass)

- **Prediction transparency:** `fitExplanation`, `FIT_CHANCE_LABELS`, `CONFIDENCE_LABELS` on cards.
- **AIR ↔ SML:** Exact-only for predictions; neighbors/interpolation labeled for rank-map API only.
- **Security:** Middleware admin gate, production admin role, import API guard, rate limit on AIR↔SML API.
- **Ops:** `/api/health`, Render health check path, `npm run test:ci`.
- **UX:** Prediction API `warnings` banner on My Chances.

---

## 4. Existing capabilities (working)

- MCC AIQ cutoffs (multi-year), college browser, seat matrix, compare, preferences/choice list.
- Maharashtra 2025 verified cutoffs when `predictionReady: true` (3,656 rows after validation).
- Rank map / AIR↔SML explorer (with exact + optional interpolated hint).
- Backtest script (`backtest-predictions`), prediction-engine unit tests.
- MH admin pipeline status page.

---

## 5. Partial / not complete

- Probability percentages (not implemented — fit bands are historical, not calibrated probabilities).
- PwD / minority / in-service quota-specific eligibility engines.
- Admin in-app cutoff verify workflow (read-only queue).
- PDF upload UI on Render (imports are CLI-first).
- PostgreSQL migration (recommended at scale; needs planned migration).
- Notifications, OpenAI integration (stubs).

---

## 6. Files created (this pass)

- `apps/web/lib/rate-limit.ts`
- `apps/web/app/api/health/route.ts`
- `.github/workflows/ci.yml`
- `docs/AUDIT_REPORT.md`

---

## 7. Files modified (this pass)

- `apps/web/lib/auth-access.ts`, `middleware.ts`
- `apps/web/lib/maharashtra-air-sml-index.ts`, `predictions.ts`
- `apps/web/app/api/predictions/route.ts`, `maharashtra/air-sml/route.ts`, `admin/import/route.ts`
- `apps/web/components/prediction/prediction-card.tsx`, `my-chances-search.tsx`
- `packages/types/src/index.ts`
- `render.yaml`, `.env.example`, `package.json`

---

## 8. Database changes

None in this pass (schema unchanged). Production data still shipped via committed `packages/database/prisma/prod.db`.

---

## 9. Prediction engine

- Separate rank scales (`AIR` vs `SML`) in `classifyFit` buffers.
- Maharashtra rows skip when SML unknown (no AIR-vs-SML comparison).
- Explanations tie fit band to median and recent closing ranks.
- No fabricated closing ranks.

---

## 10. Data ingestion

- MH 2025: merit, registered Cap-III, R1–R3 allotments, R1/R2/R2-updated/R3 matrices, AIR↔SML index.
- Regression test: `npm run test:maharashtra-cutoff-sanity`.
- Missing: Round 2 allotment PDF URL verification, stray/virtual vacancy lists, OCR.

---

## 11. Security

| Control | Notes |
|---------|--------|
| Admin | Role-based; dev bypass explicit |
| Imports | Disabled on production web by default |
| Rate limit | AIR↔SML API 60/min/IP |
| Secrets | `.env` gitignored; set on Render |
| Auth | Recommend `AUTH_REQUIRED=true` for production |

---

## 12. Tests executed

```bash
npm run test:prediction-engine    # 11 passed
npm run test:maharashtra-cutoff-sanity
npm run lint --workspace=@medcounsel/web
npm run build
```

---

## 13. Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite path (Render: `file:./packages/database/prisma/prod.db`) |
| `AUTH_SECRET` | NextAuth |
| `AUTH_URL` | Canonical site URL |
| `AUTH_REQUIRED` | `true` for login enforcement |
| `ALLOWED_USERS` | Seeded users |
| `AUTH_DEFAULT_PASSWORD` | Initial passwords (change in prod) |
| `ADMIN_DEV_OPEN` | Local admin without ADMIN role (never production) |
| `ALLOW_WEB_IMPORT` | Dangerous: enable web import on production |

---

## 14. Render deployment

1. Connect repo; use `render.yaml` blueprint.
2. Set `AUTH_URL` to `https://medcounsel.onrender.com`.
3. Set `ALLOWED_USERS` and strong `AUTH_DEFAULT_PASSWORD`.
4. Health: `GET /api/health`.
5. Refresh data: run `npm run maharashtra-2025:db` locally, commit updated `prod.db` + processed JSON, redeploy.

**SQLite note:** Free tier filesystem is ephemeral for *writes*; committed `prod.db` is copied at build. User profiles/preferences may reset unless auth + persistent DB (Postgres) is adopted.

---

## 15. Prioritized TODO (incomplete work)

1. **P0** — Enable `AUTH_REQUIRED=true` on production Render + seed ADMIN user.
2. **P0** — Commit remaining MH 2025 processed artifacts or document S3 backup.
3. **P1** — Admin cutoff verification API + UI.
4. **P1** — Zod schemas for all API bodies/query params.
5. **P1** — Per-session anonymous ID (guest data isolation).
6. **P1** — Fetch missing MH R2 allotment + stray lists from official portal.
7. **P2** — Expand backtest admin report UI.
8. **P2** — Playwright smoke tests for My Chances + rank-map.
9. **P2** — PostgreSQL migration plan + Render disk/Postgres service.
10. **P3** — OCR pipeline for scanned PDFs.
11. **P3** — Dashboard data freshness widget (global, not only MH admin).

---

## 16. Honest limitations

- Predictions are **historical rank comparisons**, not admission probabilities.
- Maharashtra 2025 is largely **one year** of verified cutoffs → confidence often **LOW/MEDIUM**.
- Special quotas (minority, in-service, PwD seat codes) are not fully modeled.
- Live site accuracy depends on deployed `prod.db` matching latest import.

---

*Generated as part of the production-readiness audit. Update this file when major phases ship.*
