# Maharashtra NEET-PG 2026 seat matrix (govt R1) — import & compare report

Generated: 2026-11-03 (local pipeline)

## 1. PDF verified

| Field | Value |
| --- | --- |
| URL | https://medical2026.mahacet.org/NEET-PGM-2026/instructions-downloadFile/Final%20PGM26-Categorywise%20Govt%20with%20Per%20on%20SQDegree.pdf |
| Title | Final PGM26 – Categorywise Govt with Per on SQ Degree |
| Authority | MAHACET / State CET Cell Maharashtra |
| Year | NEET-PG 2026 counselling |
| Pages | 32 |
| Local copy | `data/maharashtra/2026/seat_matrices/round_1/Final-PGM26-Govt-Degree.pdf` (gitignored) |

Download returned HTTP 200 and `application/pdf`.

## 2. Extraction

| Metric | Count |
| --- | ---: |
| Rows extracted | 1,420 |
| Total seats (validated rows) | 1,544 |
| Colleges (distinct headers) | 29–30 |
| Processed JSON | `data/maharashtra/2026/processed/seat_matrix_r1_govt.json` |

Parser: `packages/data-ingestion/python/maharashtra/extract_seat_matrix_r1.py`

Import report: `data/maharashtra/2026/processed/import_report.json`

## 3. Database

- Model: existing `SeatMatrix` with `year=2026`, Maharashtra colleges, MAHACET source URL.
- **2025 rows are not modified** (import deletes only `year=2026` + R1 round for Maharashtra).
- Command: `npm run import:maharashtra-2026-seat-matrix` (sets `DATABASE_URL=file:./packages/database/prisma/prod.db`).

## 4. 2025 vs 2026 comparison (govt R1 only)

Snapshot: `data/maharashtra/2026/processed/matrix_compare_2025_vs_2026.json`

| Metric | 2025 | 2026 | Δ |
| --- | ---: | ---: | ---: |
| Total seats (matched validation rules) | 1,504 | 1,544 | +40 |
| Colleges increased (net) | — | — | 5 |
| Colleges decreased (net) | — | — | 7 |
| New college keys in 2026 | — | — | 1 |
| Removed college keys | — | — | 0 |
| Detail rows compared | — | — | 2,077 |

**UI:** `/seat-matrix/compare`  
**API:** `GET /api/maharashtra/seat-matrix/compare`  
- Query: `status`, `college`, `branch`, `category`, `page`, `limit`  
- `format=csv` — full filtered export  
- `view=college` | `view=branch` — aggregates  

Missing keys on one side are **not** treated as zero seats (`new` / `removed` / `needs_review`).

## 5. Not in scope yet

- **Private** 2026 seat matrix PDF (only govt URL was supplied).
- Dedicated college drill-down route (college totals shown on compare page).
- Full category analytics page (category filter + table columns available).
- Revised-matrix versioning UI (use new source URL + import script for revisions).

## 6. Tests & CI

- `npm run test:mah-seat-matrix-compare` — fixture cases (+3, −4, 0, new, removed).
- `npm run test:ci` — prediction engine, cutoff sanity, compare fixtures, lint, build.

## 7. Render deployment

1. Commit `data/maharashtra/2026/processed/*.json` and updated `packages/database/prisma/prod.db` (if shipping DB in repo).
2. Push to GitHub; Render redeploys from `main`.
3. Ensure compare JSON paths exist on the server (same repo layout as local).
4. Optional: run `npm run import:maharashtra-2026-seat-matrix` in a one-off job if DB is migrated separately.

Do **not** treat data as fully verified until you reconcile `import_report.json` (`validation.status`) against the PDF.

## 8. Manual reconciliation

- Review duplicate aggregation keys in import report (category/quota splits).
- Confirm the one **new** college key in 2026 is an official institution (not a parser alias).
- When MAHACET publishes **private** matrix, repeat extract → import with a distinct `matrixKey` / source URL.
