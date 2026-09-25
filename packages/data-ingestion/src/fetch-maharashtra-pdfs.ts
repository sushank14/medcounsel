import fs from "fs";
import path from "path";
import { MAHARASHTRA_SELECTION_PDFS } from "./maharashtra-manifest.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/maharashtra");

export async function fetchMaharashtraPdfs(years?: number[]) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });

  const docs = years
    ? MAHARASHTRA_SELECTION_PDFS.filter((d) => years.includes(d.year))
    : MAHARASHTRA_SELECTION_PDFS;

  console.log(`📥 Downloading ${docs.length} official Maharashtra selection PDFs...`);

  for (const doc of docs) {
    const dest = path.join(IMPORT_DIR, doc.fileName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 50000) {
      console.log(`  ✓ ${doc.fileName} (cached)`);
      continue;
    }

    process.stdout.write(`  ↓ ${doc.fileName}...`);
    const res = await fetch(doc.url);
    if (!res.ok) {
      console.log(` FAILED (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(` ${(buf.length / 1024).toFixed(0)} KB`);
  }

  console.log("✅ Download complete");
}

const yearsArg = process.argv.find((a) => a.startsWith("--years="));
const years = yearsArg ? yearsArg.split("=")[1].split(",").map(Number) : undefined;

await fetchMaharashtraPdfs(years);
