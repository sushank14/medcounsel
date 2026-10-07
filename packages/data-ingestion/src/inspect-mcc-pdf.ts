import fs from "fs";
import path from "path";
import pdf from "pdf-parse/lib/pdf-parse.js";

const file = process.argv[2] ?? "../../data/imports/mcc/2025-r2-final.pdf";
const pdfPath = path.resolve(process.cwd(), file);
const data = await pdf(fs.readFileSync(pdfPath));
const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

console.log("Total lines:", lines.length);
console.log("\n--- First 80 lines ---");
lines.slice(0, 80).forEach((l, i) => console.log(`${i}: ${l}`));

const needles = process.argv.slice(3);
if (needles.length) {
  console.log("\n--- Search:", needles.join(", "), "---");
  for (let i = 0; i < lines.length; i++) {
    const window = lines.slice(i, i + 20).join(" ");
    if (needles.every((n) => window.toLowerCase().includes(n.toLowerCase()))) {
      console.log(`\n@${i}:`);
      lines.slice(i, Math.min(lines.length, i + 22)).forEach((l, j) => console.log(`${i + j}: ${l}`));
    }
  }
} else {
  console.log("\n--- Ophthalmology samples ---");
  let c = 5;
  for (let i = 0; i < lines.length && c > 0; i++) {
    if (/ophthal|OPHT|solapur|grant medical|miraj|latur/i.test(lines[i])) {
      console.log(`\n@${i}:`, lines.slice(Math.max(0, i - 5), i + 8).join(" | "));
      c--;
    }
  }
}
