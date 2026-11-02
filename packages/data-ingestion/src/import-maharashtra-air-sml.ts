/**
 * Build verified AIR ↔ SML index from official Maharashtra registered-candidate PDFs.
 */
import fs from "fs";
import path from "path";
import { getMaharashtraManifest } from "./maharashtra-manifest.js";
import {
  buildAirSmlIndex,
  parseMaharashtraRegisteredPdfFile,
} from "./parse-maharashtra-registered-pdf.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/maharashtra");
const OUT_DIR = path.resolve(process.cwd(), "../../data/processed/maharashtra");

async function main() {
  const docs = getMaharashtraManifest().filter((d) => d.kind === "REGISTERED");
  if (docs.length === 0) {
    console.error("No REGISTERED docs in manifest");
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
    const rows = await parseMaharashtraRegisteredPdfFile(pdfPath);
    const index = buildAirSmlIndex(rows, {
      year: doc.year,
      listLabel: doc.listLabel ?? doc.round,
      sourceUrl: doc.url,
    });

    const outFile = path.join(OUT_DIR, `${doc.year}-${doc.listLabel ?? doc.round}-air-sml-index.json`);
    fs.writeFileSync(outFile, JSON.stringify(index));
    console.log(`✅ ${rows.length.toLocaleString("en-IN")} rows → ${outFile}`);

    const sampleAir = rows.find((r) => r.air >= 15_000 && r.air <= 16_000);
    if (sampleAir) {
      console.log(`   Sample: AIR ${sampleAir.air} → SML ${sampleAir.smlRank} (${sampleAir.category})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
