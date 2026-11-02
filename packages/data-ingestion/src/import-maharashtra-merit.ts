/**
 * Parse Maharashtra state merit list PDFs → roll lookup index (no candidate names stored).
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
  const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
  const years = yearArg ? yearArg.split(",").map(Number) : undefined;

  let docs = getMaharashtraManifest().filter((d) => d.kind === "MERIT");
  if (years?.length) docs = docs.filter((d) => years.includes(d.year));

  if (docs.length === 0) {
    console.error("No MERIT docs matched");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const doc of docs) {
    const pdfPath = path.join(IMPORT_DIR, doc.fileName);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`⚠ Missing ${pdfPath} — run: npm run fetch:maharashtra`);
      continue;
    }

    console.log(`📄 Parsing ${doc.title}...`);
    const rows = await parseMaharashtraMeritPdfFile(pdfPath);
    const index = buildMeritIndex(rows, { year: doc.year, round: doc.round, sourceUrl: doc.url });

    const outFile = path.join(OUT_DIR, `${doc.year}-${doc.round.toLowerCase()}-merit-index.json`);
    fs.writeFileSync(outFile, JSON.stringify(index));

    console.log(`✅ ${rows.length.toLocaleString("en-IN")} candidates → ${outFile}`);
    if (rows.length > 0) {
      console.log(`   Sample: roll ${rows[0].neetRoll} → SML ${rows[0].smlRank}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
