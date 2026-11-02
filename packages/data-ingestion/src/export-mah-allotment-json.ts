/**
 * Export Maharashtra selection/allotment PDF rows to JSON for Python pipeline.
 * Usage: tsx export-mah-allotment-json.ts <pdf> <out.json> <R1|R2|R3>
 */
import fs from "fs";
import { parseMaharashtraPdfFile } from "./parse-maharashtra-pdf.js";

const pdfPath = process.argv[2];
const outPath = process.argv[3];
const round = process.argv[4] ?? "R1";

if (!pdfPath || !outPath) {
  console.error("Usage: tsx export-mah-allotment-json.ts <pdf> <out.json> <round>");
  process.exit(1);
}

const year = 2025;
const parsed = await parseMaharashtraPdfFile(pdfPath, year, round);
const payload = {
  year,
  round,
  sourcePath: pdfPath,
  generatedAt: new Date().toISOString(),
  selections: parsed.selections,
  cutoffs: parsed.cutoffs,
  warnings: [] as string[],
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
console.log(`Wrote ${parsed.selections.length} selections to ${outPath}`);
