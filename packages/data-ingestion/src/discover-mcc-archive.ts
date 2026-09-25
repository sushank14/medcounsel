/**
 * Discovers official MCC NEET-PG final allotment PDFs from mcc.nic.in/archive-pg
 * and writes packages/data-ingestion/src/mcc-manifest.generated.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { MccDocument } from "./mcc-manifest.js";

const ARCHIVE_URLS = [
  "https://mcc.nic.in/archive-pg/",
  "https://mcc.nic.in/pg-medical-counselling/",
];
const OUT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "mcc-manifest.generated.json");

function normalizeUrl(url: string) {
  return url.replace(/^http:/i, "https:");
}

function inferCounsellingYear(title: string): number | null {
  const matches = [...title.matchAll(/20\d{2}/g)].map((m) => parseInt(m[0], 10));
  if (!matches.length) return null;
  // Prefer explicit "PG Counselling YYYY" / "PG YYYY" / "NEET PG YYYY"
  const counselling = title.match(/(?:PG Counselling|NEET PG|PG)\s*(?:Counselling\s*)?(20\d{2})/i);
  if (counselling) return parseInt(counselling[1], 10);
  return Math.max(...matches);
}

function inferRound(title: string): MccDocument["round"] | null {
  const t = title.toLowerCase();
  if (/special\s+stray|special stray/.test(t)) return "SPECIAL";
  if (/stray|mop\s*up|mopup/.test(t)) return "STRAY";
  if (/round\s*[- ]?\s*3|round\s*iii|\br3\b/.test(t)) return "R3";
  if (/round\s*[- ]?\s*2|round\s*ii|\br2\b/.test(t)) return "R2";
  if (/round\s*[- ]?\s*1|round\s*one|\br1\b/.test(t)) return "R1";
  return null;
}

function isFinalAllotmentTitle(title: string) {
  const t = title.toLowerCase();
  if (/provisional|notice for|eligible candidates|seat matrix|vacant seats|clear vac/i.test(t)) {
    return false;
  }
  if (!/final (allotment|result|counselling result)/i.test(title)) return false;
  if (!/pg|neet|md\s*\/?\s*ms|diploma|dnb/i.test(title)) return false;
  return true;
}

export function parseArchiveHtml(html: string): MccDocument[] {
  const seen = new Set<string>();
  const docs: MccDocument[] = [];

  const linkRe = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  // Also match <a download href="...pdf">Title</a> on the live counselling page
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html))) {
    const url = normalizeUrl(match[1]);
    const text = match[2].replace(/\s+/g, " ").trim();
    if (text.startsWith("View") || text.length < 12) continue;
    if (!isFinalAllotmentTitle(text)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const year = inferCounsellingYear(text);
    const round = inferRound(text);
    if (!year || !round) continue;
    if (year < 2020 || year > 2026) continue;

    const fileName = `${year}-${round.toLowerCase()}-${path.basename(url).replace(/[^\w.-]+/g, "-")}`;
    docs.push({ year, round, title: text, url, fileName });
  }

  // Prefer one doc per year+round — keep largest file name (usually main result, not duplicate)
  const byKey = new Map<string, MccDocument>();
  for (const doc of docs) {
    const key = `${doc.year}-${doc.round}`;
    const existing = byKey.get(key);
    if (!existing || doc.fileName.length > existing.fileName.length) {
      byKey.set(key, doc);
    }
  }

  return [...byKey.values()].sort((a, b) => b.year - a.year || a.round.localeCompare(b.round));
}

async function main() {
  const allDocs: MccDocument[] = [];
  const seen = new Set<string>();

  for (const url of ARCHIVE_URLS) {
    console.log(`🔍 Fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`   ⚠ Skipped (${res.status})`);
      continue;
    }
    const html = await res.text();
    for (const doc of parseArchiveHtml(html)) {
      const key = `${doc.year}-${doc.round}-${doc.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allDocs.push(doc);
    }
  }

  const docs = allDocs.sort((a, b) => b.year - a.year || a.round.localeCompare(b.round));

  fs.writeFileSync(OUT_FILE, JSON.stringify(docs, null, 2));
  console.log(`✅ Discovered ${docs.length} final allotment PDFs`);
  for (const d of docs) {
    console.log(`   ${d.year} ${d.round.padEnd(7)} ${d.title.slice(0, 70)}`);
  }
  console.log(`\nSaved → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
