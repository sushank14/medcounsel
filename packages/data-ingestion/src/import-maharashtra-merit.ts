/**
 * Parse Maharashtra state merit list PDF → roll lookup index (no candidate names stored).
 */
import fs from "fs";
import path from "path";
import { getMaharashtraManifest } from "./maharashtra-manifest.js";
import {
  buildMeritIndex,
  parseMaharashtraMeritPdfFile,
} from "./parse-maharashtra-merit-pdf.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/maharashtra");
const OUT_DIR = path.resolve(process.cwd(), "../../data/processed/maharashtra");

async function main() {
  const yearArg = parseInt(process.argv.find((a) => a.startsWith("--year="))?.split("=")[1] ?? "2026", 10);

  const doc = getMaharashtraManifest().find((d) => d.year === yearArg && d.kind === "MERIT");
  if (!doc) {
    console.error(`No MERIT manifest for ${yearArg}`);
    process.exit(1);
  }

  const pdfPath = path.join(IMPORT_DIR, doc.fileName);
  if (!fs.existsSync(pdfPath)) {
    console.error(`Missing ${pdfPath}. Run: npm run fetch:maharashtra`);
    process.exit(1);
  }

  console.log(`📄 Parsing ${doc.title}...`);
  const rows = await parseMaharashtraMeritPdfFile(pdfPath);
  const index = buildMeritIndex(rows, { year: doc.year, round: doc.round, sourceUrl: doc.url });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${doc.year}-${doc.round.toLowerCase()}-merit-index.json`);
  fs.writeFileSync(outFile, JSON.stringify(index));

  console.log(`✅ ${rows.length.toLocaleString("en-IN")} candidates → ${outFile}`);
  if (rows.length > 0) {
    console.log(`   Sample: roll ${rows[0].neetRoll} → SML ${rows[0].smlRank}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
