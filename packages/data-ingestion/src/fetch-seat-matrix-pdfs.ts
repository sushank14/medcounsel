import fs from "fs";
import path from "path";
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");

async function main() {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  const docs = getSeatMatrixManifest();

  console.log(`📥 Downloading MCC NEET-PG seat matrix PDFs + official sheets...`);

  for (const doc of docs) {
    if (doc.googleSheetId && doc.googleSheetGid && doc.csvFileName) {
      const csvDest = path.join(IMPORT_DIR, doc.csvFileName);
      process.stdout.write(`  ↓ Google Sheet → ${doc.csvFileName}...`);
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${doc.googleSheetId}/gviz/tq?tqx=out:csv&gid=${doc.googleSheetGid}`;
      const sheetRes = await fetch(sheetUrl);
      if (sheetRes.ok) {
        const csv = await sheetRes.text();
        fs.writeFileSync(csvDest, csv);
        console.log(` ✓ ${(csv.length / 1024).toFixed(0)} KB`);
      } else {
        console.log(` ⚠ sheet failed (${sheetRes.status})`);
      }
    }

    const dest = path.join(IMPORT_DIR, doc.fileName);
    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${doc.fileName} (cached)`);
      continue;
    }

    process.stdout.write(`  ↓ ${doc.title.slice(0, 60)}...`);
    const res = await fetch(doc.url);
    if (!res.ok) {
      console.log(` ⚠ failed (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(` ✓ ${(buf.length / 1024).toFixed(0)} KB`);
  }

  console.log("\n✅ Seat matrix download complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
