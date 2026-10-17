/**
 * Compare MCC AIQ 2026 Google Sheet StateName vs college.state in DB (by nmcId).
 * Run: npm run audit-mcc-seat-matrix-states --workspace=@medcounsel/data-ingestion
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";
import { loadSeatMatrixRows } from "./load-seat-matrix-rows.js";
import { normalizeMccSheetState, isGarbageCollegeState } from "./mcc-state-names.js";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultProdDb = path.resolve(packageRoot, "../../database/prisma/prod.db");
const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url ?? `file:${defaultProdDb}`;
  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;
  return `file:${defaultProdDb}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const doc = getSeatMatrixManifest().find((d) => d.year === 2026 && d.category === "AIQ");
  if (!doc) throw new Error("AIQ 2026 manifest missing");

  const { rows } = await loadSeatMatrixRows(doc, IMPORT_DIR);
  const sheetByCode = new Map<string, string>();
  for (const r of rows) {
    sheetByCode.set(r.instituteCode, normalizeMccSheetState(r.state));
  }

  const colleges = await prisma.college.findMany({
    where: { nmcId: { in: [...sheetByCode.keys()] } },
    select: { nmcId: true, name: true, state: true },
  });

  let match = 0;
  const mismatches: { code: string; sheet: string; db: string; name: string }[] = [];
  const garbage: string[] = [];

  for (const [code, sheetState] of sheetByCode) {
    const c = colleges.find((x) => x.nmcId === code);
    if (!c) continue;
    if (isGarbageCollegeState(c.state)) garbage.push(`${code} db="${c.state}"`);
    if (c.state === sheetState) match++;
    else mismatches.push({ code, sheet: sheetState, db: c.state, name: c.name.slice(0, 50) });
  }

  console.log("🔍 MCC AIQ 2026 — StateName vs college.state\n");
  console.log(`Institutes in sheet: ${sheetByCode.size}`);
  console.log(`Matched state: ${match}`);
  console.log(`Mismatched: ${mismatches.length}`);
  console.log(`Garbage DB state (before fix): ${garbage.length}`);

  if (mismatches.length) {
    console.log("\nSample mismatches:");
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  ${m.code} sheet="${m.sheet}" db="${m.db}"`);
    }
  }

  const reportPath = path.resolve(process.cwd(), "../../data/processed/mcc/2026-aiq-state-audit.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ match, mismatches: mismatches.length, mismatchesSample: mismatches.slice(0, 200) }, null, 2)
  );
  console.log(`\nReport: ${reportPath}`);

  if (mismatches.length > 0) process.exitCode = 1;
  else console.log("\n✅ All AIQ institute states match the official sheet");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
