# MedCounsel AI

NEET-PG counselling intelligence platform for Indian medical graduates.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env — set AUTH_SECRET (openssl rand -base64 32)

# Initialize database
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the next available port if 3000 is in use)

## Demo Accounts

- **Candidate:** `demo@medcounsel.demo` (use email login on /login)
- **Admin:** `admin@medcounsel.demo`

## Import Maharashtra State Data (2025–2026)

```bash
npm run fetch:maharashtra           # Merit, selection, registered, seat matrix PDFs (CET S3)
npm run import:maharashtra          # SML closing ranks → database (selection lists)
npm run import:maharashtra-merit    # Roll → SML JSON indexes (2026 merit PDF)
npm run import:maharashtra-air-sml  # AIR ↔ SML from official registered-candidate PDF
```

Processed JSON lives under `data/processed/maharashtra/` and `data/maharashtra/2025/processed/` (Python pipeline). **My Chances** uses AIR→SML mapping automatically for Maharashtra when you enter AIR.

```bash
pip install -r packages/data-ingestion/python/maharashtra/requirements.txt
python3.11 packages/data-ingestion/python/maharashtra/run_pipeline.py   # download + extract + validate
python3.11 packages/data-ingestion/python/maharashtra/run_pipeline.py --skip-download
cd packages/data-ingestion && npx tsx src/import-mah-pipeline-audit.ts   # optional: load audits into DB
```

Admin: `/admin/maharashtra` · API: `/api/admin/maharashtra/pipeline`

**Database (required before Maharashtra predictions):**

```bash
npm run maharashtra-2025:db   # pipeline + Prisma import + validation
```

Sets `Counselling.config.maharashtra2025.predictionReady`. My Chances uses **only VERIFIED 2025 Maharashtra cutoffs** when ready; STATE-only predictions stay empty until validation passes.

UI: **Counselling Hub → AIR ↔ SML map** (`/maharashtra/rank-map`).

## Import Official MCC Data (2021–2025)

```bash
npm run fetch:mcc     # Download official PDFs from mcc.nic.in
npm run import:mcc    # Parse allotments → category-wise closing ranks
```

This imports AIQ cutoffs from MCC allotment PDFs (2020–2025 final; **2026 Round 1 provisional** when published).

## Important

Demo seed data is marked **DEMO**. Official MCC imports are marked **VERIFIED/OFFICIAL**.
Predictions are estimates and do not guarantee admission.

## Prediction backtest (hold-out accuracy)

```bash
npm run backtest:predictions   # Writes data/reports/backtest-predictions.json
```

Results appear on **Disclaimer** and **Admin → Imports** (separate **AIQ AIR** and **Maharashtra SML** tracks). Re-run after cutoff imports.

## Project Structure

```
apps/web/          Next.js frontend + API routes
packages/database/ Prisma schema + seed data
packages/types/    Shared TypeScript types
packages/prediction-engine/ Rule-based prediction logic
```

## Official Data Sources (for production import)

- MCC: https://mcc.nic.in/pg-medical-counselling/
- NMC: https://www.nmc.org.in/information-desk/college-and-course-search/
- State CET cells (Maharashtra, Karnataka, etc.)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
