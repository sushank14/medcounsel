/**
 * Writes import + validation report for MAH 2026 R1 govt seat matrix JSON.
 * Run: tsx src/write-mah-2026-import-report.ts
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const REPO = path.resolve(process.cwd(), "../..");
const JSON_PATH = path.join(REPO, "data/maharashtra/2026/processed/seat_matrix_r1_govt.json");
const OUT = path.join(REPO, "data/maharashtra/2026/processed/import_report.json");
const COMPARE_OUT = path.join(REPO, "data/maharashtra/2026/processed/matrix_compare_2025_vs_2026.json");

function isValidCollege(name: string): boolean {
  if (name.length < 12) return false;
  if (/^\d+(MD|MS)\s/i.test(name)) return false;
  if (/seat position|allotment of above|muhs nashik/i.test(name)) return false;
  return /medical college|hospital|institute|rehabilitation|aiipmr|municipal|muncipal/i.test(name);
}

type Row = {
  college_name_norm?: string;
  college_name_raw?: string;
  branch_name_norm?: string;
  category?: string;
  seat_count?: number;
};

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error("Missing", JSON_PATH);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8")) as {
    meta: Record<string, unknown>;
    rows: Row[];
  };
  const rows = payload.rows ?? [];
  let imported = 0;
  let skippedInvalidCollege = 0;
  let skippedZeroSeats = 0;
  const unmatchedColleges: string[] = [];
  const keys = new Set<string>();
  let duplicates = 0;

  for (const r of rows) {
    const college = r.college_name_norm || r.college_name_raw || "";
    const seats = r.seat_count ?? 0;
    if (seats <= 0) {
      skippedZeroSeats++;
      continue;
    }
    if (!isValidCollege(college)) {
      skippedInvalidCollege++;
      if (college && !unmatchedColleges.includes(college)) unmatchedColleges.push(college);
      continue;
    }
    const k = `${college}|${r.branch_name_norm}|${r.category}`;
    if (keys.has(k)) duplicates++;
    keys.add(k);
    imported++;
  }

  const report = {
    generated_at: new Date().toISOString(),
    source: payload.meta,
    pdf_pages: payload.meta.pages ?? null,
    rows_extracted: rows.length,
    rows_import_ready: imported,
    skipped_zero_seats: skippedZeroSeats,
    skipped_invalid_college: skippedInvalidCollege,
    duplicate_keys: duplicates,
    unmatched_or_rejected_college_names: unmatchedColleges.slice(0, 50),
    validation: {
      status: skippedInvalidCollege === 0 ? "ok" : "needs_review",
      note:
        skippedInvalidCollege > 0
          ? "Some rows failed college header validation; compare totals use validated rows only."
          : "All positive seat rows passed college validation.",
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("Wrote", OUT);

  const path2025 = path.join(REPO, "data/maharashtra/2025/processed/seat_matrix_r1_govt.json");
  if (fs.existsSync(path2025)) {
    try {
      execSync(
        `node --import tsx/esm -e "import { compareMaharashtraSeatMatrices } from './lib/maharashtra-seat-matrix-compare.ts'; import fs from 'fs'; const c=compareMaharashtraSeatMatrices(2025,2026); fs.writeFileSync('${COMPARE_OUT}', JSON.stringify({ summary: c?.summary, generated_at: new Date().toISOString() }, null, 2));"`,
        { cwd: path.join(REPO, "apps/web"), stdio: "inherit" }
      );
      console.log("Wrote", COMPARE_OUT);
    } catch {
      console.warn("Could not write compare snapshot");
    }
  }
}

main();
