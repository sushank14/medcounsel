/**
 * Export Maharashtra registered-candidate PDF to JSON (pdf-parse layout).
 * Usage: tsx export-mah-registered-json.ts <pdf> <out.json>
 */
import fs from "fs";
import { buildAirSmlIndex, parseMaharashtraRegisteredPdfFile } from "./parse-maharashtra-registered-pdf.js";

const pdfPath = process.argv[2];
const outPath = process.argv[3];

if (!pdfPath || !outPath) {
  console.error("Usage: tsx export-mah-registered-json.ts <pdf> <out.json>");
  process.exit(1);
}

const rows = await parseMaharashtraRegisteredPdfFile(pdfPath);
const index = buildAirSmlIndex(rows, {
  year: 2025,
  listLabel: "reg-cap3",
  sourceUrl: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/pgm-reg-cap3.pdf",
});

fs.writeFileSync(
  outPath,
  JSON.stringify({ rows, index, generatedAt: new Date().toISOString() }, null, 2),
  "utf-8"
);
console.log(`Wrote ${rows.length} registered rows to ${outPath}`);
