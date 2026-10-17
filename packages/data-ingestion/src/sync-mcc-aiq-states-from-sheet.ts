/**
 * One-shot: set college.state from MCC AIQ 2026 Google Sheet StateName (by nmcId).
 * Run: npm run sync-mcc-aiq-states --workspace=@medcounsel/data-ingestion
 */
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";
import { loadSeatMatrixRows } from "./load-seat-matrix-rows.js";
import { normalizeMccSheetState } from "./mcc-state-names.js";

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

  const { rows, source } = await loadSeatMatrixRows(doc, IMPORT_DIR);
  console.log(`Loaded ${rows.length} AIQ rows (${source})`);

  const byCode = new Map<string, string>();
  for (const r of rows) {
    const state = normalizeMccSheetState(r.state);
    if (state !== "Unknown") byCode.set(r.instituteCode, state);
  }

  let updated = 0;
  for (const [code, state] of byCode) {
    const res = await prisma.college.updateMany({ where: { nmcId: code }, data: { state } });
    updated += res.count;
  }
  console.log(`✅ Updated state on ${updated} colleges (${byCode.size} institute codes in sheet)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
