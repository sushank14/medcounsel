/**
 * Maharashtra NEET-PG provisional / final state merit list (SML order, no college/course).
 */
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

export interface ParsedMahMeritRow {
  smlRank: number;
  neetRoll: string;
  applicationNo: string;
  categoryRaw: string;
  category: string;
  neetScore: number;
  categoryMeritNo: number;
  candidatureType: "State" | "NRI" | string;
}

const ROLL_RE = /^266\d{8}$/;
const APP_RE = /^(\d{9})(.*)$/;
const SCORE_RE = /^\d{3}$/;

function mapMeritCategory(raw: string): string {
  const s = raw.toUpperCase();
  if (!s) return "GENERAL";
  if (s.includes("OBC") || s.includes("SEBC") || s.includes("NT")) return "OBC";
  if (s.includes("EWS")) return "EWS";
  if (/\bSC\b/.test(s)) return "SC";
  if (/\bST\b/.test(s)) return "ST";
  if (s.includes("PWD") || s.includes("PH")) return "PWD";
  return "GENERAL";
}

function isHeaderLine(line: string): boolean {
  return /^(Page \d|Merit No|SMLNEET|Common Provisional|Government of|STATE COMMON|Roll No|NEET PG|Score|Name of|Remark|Type)$/i.test(
    line
  );
}

export function parseMaharashtraMeritText(text: string): ParsedMahMeritRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isHeaderLine(l) && !/^For\s+Maharashtra$/i.test(l) && !/^Dated/i.test(l));

  const results: ParsedMahMeritRow[] = [];
  let i = 0;

  while (i < lines.length - 5) {
    const smlMaybe = lines[i];
    const rollMaybe = lines[i + 1];

    if (!/^\d+$/.test(smlMaybe) || !ROLL_RE.test(rollMaybe)) {
      i++;
      continue;
    }

    const smlRank = parseInt(smlMaybe, 10);
    if (smlRank < 1 || smlRank > 100_000) {
      i++;
      continue;
    }

    const neetRoll = rollMaybe;
    i += 2;

    const nameParts: string[] = [];
    while (i < lines.length && !APP_RE.test(lines[i])) {
      if (ROLL_RE.test(lines[i]) || /^(State|NRI)$/i.test(lines[i])) break;
      if (/^\d+$/.test(lines[i]) && parseInt(lines[i], 10) === smlRank + 1) break;
      nameParts.push(lines[i]);
      i++;
    }

    if (i >= lines.length || !APP_RE.test(lines[i])) continue;

    const appMatch = lines[i].match(APP_RE)!;
    const applicationNo = appMatch[1];
    const categoryRaw = (appMatch[2] ?? "").trim();
    i++;

    if (i >= lines.length || !SCORE_RE.test(lines[i])) continue;
    const neetScore = parseInt(lines[i], 10);
    i++;

    if (i >= lines.length || !/^\d+$/.test(lines[i])) continue;
    const categoryMeritNo = parseInt(lines[i], 10);
    i++;

    if (i >= lines.length) break;
    const candidatureType = lines[i];
    if (!/^(State|NRI)$/i.test(candidatureType)) {
      continue;
    }
    i++;

    results.push({
      smlRank,
      neetRoll,
      applicationNo,
      categoryRaw,
      category: mapMeritCategory(categoryRaw),
      neetScore,
      categoryMeritNo,
      candidatureType,
    });
  }

  return results;
}

export async function parseMaharashtraMeritPdfFile(filePath: string): Promise<ParsedMahMeritRow[]> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return parseMaharashtraMeritText(data.text);
}

export type MaharashtraMeritIndex = {
  year: number;
  round: string;
  sourceUrl: string;
  generatedAt: string;
  totalRows: number;
  byRoll: Record<
    string,
    {
      smlRank: number;
      neetScore: number;
      category: string;
      categoryRaw: string;
      categoryMeritNo: number;
      candidatureType: string;
      applicationNo: string;
    }
  >;
};

export function buildMeritIndex(
  rows: ParsedMahMeritRow[],
  meta: { year: number; round: string; sourceUrl: string }
): MaharashtraMeritIndex {
  const byRoll: MaharashtraMeritIndex["byRoll"] = {};
  for (const r of rows) {
    byRoll[r.neetRoll] = {
      smlRank: r.smlRank,
      neetScore: r.neetScore,
      category: r.category,
      categoryRaw: r.categoryRaw,
      categoryMeritNo: r.categoryMeritNo,
      candidatureType: r.candidatureType,
      applicationNo: r.applicationNo,
    };
  }
  return {
    year: meta.year,
    round: meta.round,
    sourceUrl: meta.sourceUrl,
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    byRoll,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const rows = await parseMaharashtraMeritPdfFile(file);
  console.log(`Parsed ${rows.length} merit rows`);
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));
}
