import fs from "fs";
import path from "path";
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");

async function main() {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  const docs = getSeatMatrixManifest();

  console.log(`📥 Downloading ${docs.length} MCC NEET-PG seat matrix PDFs...`);

  for (const doc of docs) {
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
