import path from "path";
import { parseMccPdfFile } from "./parse-mcc-pdf.js";
import { detectAndParse, parseStandardLines, parseUpgradeAbbrev } from "./mcc-format-parsers.js";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");

async function analyze(file: string, year: number, round: string) {
  const pdfPath = path.join(IMPORT_DIR, file);
  const { allotments, cutoffs } = await parseMccPdfFile(pdfPath, year, round);

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const standard = parseStandardLines(lines);
  const upgrade = parseUpgradeAbbrev(lines);

  const mhObcOph = cutoffs.filter(
    (c) =>
      c.category === "OBC" &&
      c.quota === "AIQ" &&
      c.specialtySlug.includes("ophthalm") &&
      /maharashtra|mumbai|pune|nagpur|solapur|miraj|latur|grant|dhule|jalgaon|akola|nanded|ambajogai|chandrapur|yavatmal|thane|kolhapur|aurangabad|sambhajinagar/i.test(
        c.institute
      )
  );

  console.log(`\n=== ${year} ${round} (${file}) ===`);
  console.log(`detectAndParse → ${allotments.length} allotments, ${cutoffs.length} cutoffs`);
  console.log(`parseStandardLines → ${standard.length}`);
  console.log(`parseUpgradeAbbrev → ${upgrade.length}`);
  console.log(`Categories: ${[...new Set(cutoffs.map((c) => c.category))].sort().join(", ")}`);
  console.log(`MH OBC Ophthalmology cutoffs: ${mhObcOph.length}`);
  mhObcOph
    .sort((a, b) => a.closingRank - b.closingRank)
    .slice(0, 20)
    .forEach((c) =>
      console.log(`  ${c.closingRank} | ${c.institute.slice(0, 55)} | ${c.specialtySlug}`)
    );
}

async function main() {
  await analyze("2025-r1-final.pdf", 2025, "R1");
  await analyze("2025-r2-final.pdf", 2025, "R2");
  await analyze("2025-r3-final.pdf", 2025, "R3");
}

main().catch(console.error);
