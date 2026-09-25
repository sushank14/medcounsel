import fs from "fs";
import path from "path";
import { getMccManifest } from "./mcc-manifest.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");

export async function fetchMccPdfs(years?: number[]) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });

  const manifest = getMccManifest();
  const docs = years ? manifest.filter((d) => years.includes(d.year)) : manifest;

  console.log(`📥 Downloading ${docs.length} official MCC PDFs...`);

  for (const doc of docs) {
    const dest = path.join(IMPORT_DIR, doc.fileName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
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
    console.log(` ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  }

  console.log("✅ Download complete");
}

const yearsArg = process.argv.find((a) => a.startsWith("--years="));
const years = yearsArg
  ? yearsArg.split("=")[1].split(",").map(Number)
  : undefined;

await fetchMccPdfs(years);
