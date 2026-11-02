/**
 * Maharashtra CET "Registered Candidates" PDFs — Sr.No ≈ SML, NEET roll, AIR, score, category.
 * Names are skipped in output (lookup index only).
 */
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

export type ParsedMahRegisteredRow = {
  smlRank: number;
  neetRoll: string;
  air: number;
  neetScore: number;
  applicationNo: string;
  categoryRaw: string;
  category: string;
  pwd: boolean;
  inService: boolean;
  nri: boolean;
  minority: boolean;
};

const ROLL_RE = /^256\d{8}$/;
const APP_RE = /^258\d{6}$/;

function mapRegisteredCategory(raw: string): string {
  const s = raw.toUpperCase();
  if (s.includes("OBC") || s.includes("SEBC") || s.includes("NT(") || s.includes("DT-")) return "OBC";
  if (s.includes("EWS")) return "EWS";
  if (/\bSC\b/.test(s)) return "SC";
  if (/\bST\b/.test(s)) return "ST";
  if (s.includes("SBC")) return "OBC";
  return "GENERAL";
}

function isNoiseLine(line: string): boolean {
  return /^(Page \d|Sr\.?\s*No|Rank|Score|Provisional|Government|STATE COMMON|Roll|NEET PG|Category|PWD|Name of|Dated|Cet Cell)/i.test(
    line
  );
}

const MERGED_APP_ROLL = /^258(\d{6})(256\d{8})$/;

function parseMergedAppRoll(line: string): { applicationNo: string; neetRoll: string } | null {
  const compact = line.replace(/\s+/g, "");
  const m = compact.match(MERGED_APP_ROLL);
  if (!m) return null;
  return { applicationNo: `258${m[1]}`, neetRoll: m[2]! };
}

function parseAirScoreLine(line: string): { air: number; neetScore: number } | null {
  const m = line.trim().match(/^(\d{1,6})\s+(\d{2,3})$/);
  if (!m) return null;
  const air = parseInt(m[1]!, 10);
  const neetScore = parseInt(m[2]!, 10);
  if (air < 1 || air > 500_000 || neetScore < 100 || neetScore > 720) return null;
  return { air, neetScore };
}

function parseCategoryLine(line: string): { categoryRaw: string; flags: Pick<ParsedMahRegisteredRow, "pwd" | "inService" | "nri" | "minority"> } | null {
  const s = line.trim().toUpperCase();
  if (!s || /^\d+$/.test(s)) return null;
  if (/^(OPEN|EWS|SC|ST|OBC|SBC|NRI)$/.test(s)) {
    return { categoryRaw: s, flags: { pwd: false, inService: false, nri: s === "NRI", minority: false } };
  }
  if (/^(MUSLIM|JAIN)$/.test(s)) {
    return { categoryRaw: "OPEN", flags: { pwd: false, inService: false, nri: false, minority: true } };
  }
  if (/OBCYES$/.test(s.replace(/\s/g, ""))) {
    return { categoryRaw: "OBC", flags: { pwd: false, inService: true, nri: false, minority: false } };
  }
  if (/STYES$/.test(s.replace(/\s/g, ""))) {
    return { categoryRaw: "ST", flags: { pwd: false, inService: true, nri: false, minority: false } };
  }
  if (/^DT-VJ\(A\)$|^NT\([A-D]\)$|^NT[A-D]$/.test(s)) {
    return { categoryRaw: s, flags: { pwd: false, inService: false, nri: false, minority: false } };
  }
  if (/^[A-Z()\-]{2,20}$/.test(s)) {
    return { categoryRaw: s, flags: { pwd: false, inService: false, nri: false, minority: false } };
  }
  return null;
}

/** CET registered-list PDFs (2025+) — block layout: name, app+roll, air+score, category, SML serial */
export function parseMaharashtraRegisteredText(text: string): ParsedMahRegisteredRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isNoiseLine(l));

  const results: ParsedMahRegisteredRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const merged = parseMergedAppRoll(lines[i]!);
    if (!merged) {
      i++;
      continue;
    }

    const airScore = i + 1 < lines.length ? parseAirScoreLine(lines[i + 1]!) : null;
    const catLine = i + 2 < lines.length ? parseCategoryLine(lines[i + 2]!) : null;
    let smlLineIdx = i + 3;
    let minorityFollow = false;
    if (i + 3 < lines.length && /^(MUSLIM|JAIN)$/i.test(lines[i + 3]!)) {
      minorityFollow = true;
      smlLineIdx = i + 4;
    }
    const smlMaybe =
      smlLineIdx < lines.length && /^\d+$/.test(lines[smlLineIdx]!)
        ? parseInt(lines[smlLineIdx]!, 10)
        : NaN;

    if (!airScore || !catLine || !Number.isFinite(smlMaybe)) {
      i++;
      continue;
    }

    const flags = { ...catLine.flags };
    if (minorityFollow) flags.minority = true;

    results.push({
      smlRank: smlMaybe,
      neetRoll: merged.neetRoll,
      air: airScore.air,
      neetScore: airScore.neetScore,
      applicationNo: merged.applicationNo,
      categoryRaw: catLine.categoryRaw,
      category: mapRegisteredCategory(catLine.categoryRaw),
      ...flags,
    });

    i = smlLineIdx + 1;
  }

  return results;
}

export async function parseMaharashtraRegisteredPdfFile(filePath: string): Promise<ParsedMahRegisteredRow[]> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return parseMaharashtraRegisteredText(data.text);
}

export type MaharashtraAirSmlIndex = {
  year: number;
  listLabel: string;
  sourceUrl: string;
  generatedAt: string;
  totalRows: number;
  byAir: Record<
    string,
    {
      smlRank: number;
      neetRoll: string;
      neetScore: number;
      category: string;
      categoryRaw: string;
    }
  >;
  byRoll: Record<string, { air: number; smlRank: number }>;
};

export function buildAirSmlIndex(
  rows: ParsedMahRegisteredRow[],
  meta: { year: number; listLabel: string; sourceUrl: string }
): MaharashtraAirSmlIndex {
  const byAir: MaharashtraAirSmlIndex["byAir"] = {};
  const byRoll: MaharashtraAirSmlIndex["byRoll"] = {};
  for (const r of rows) {
    byAir[String(r.air)] = {
      smlRank: r.smlRank,
      neetRoll: r.neetRoll,
      neetScore: r.neetScore,
      category: r.category,
      categoryRaw: r.categoryRaw,
    };
    byRoll[r.neetRoll] = { air: r.air, smlRank: r.smlRank };
  }
  return {
    year: meta.year,
    listLabel: meta.listLabel,
    sourceUrl: meta.sourceUrl,
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    byAir,
    byRoll,
  };
}

/** Nearest verified AIR rows when exact AIR is absent from the published list. */
export function estimateSmlFromAir(
  index: MaharashtraAirSmlIndex,
  air: number
): {
  estimated: boolean;
  smlRank: number;
  method: "exact" | "interpolate" | "unavailable";
  lower?: { air: number; smlRank: number };
  upper?: { air: number; smlRank: number };
} {
  const exact = index.byAir[String(air)];
  if (exact) {
    return { estimated: false, smlRank: exact.smlRank, method: "exact" };
  }

  const pairs = Object.entries(index.byAir)
    .map(([a, v]) => ({ air: parseInt(a, 10), smlRank: v.smlRank }))
    .sort((x, y) => x.air - y.air);

  if (pairs.length === 0) return { estimated: true, smlRank: 0, method: "unavailable" };

  let lower = pairs[0]!;
  let upper = pairs[pairs.length - 1]!;
  for (const p of pairs) {
    if (p.air <= air) lower = p;
    if (p.air >= air) {
      upper = p;
      break;
    }
  }

  if (air <= lower.air) return { estimated: true, smlRank: lower.smlRank, method: "interpolate", lower, upper: lower };
  if (air >= upper.air) return { estimated: true, smlRank: upper.smlRank, method: "interpolate", lower: upper, upper };

  const ratio = (air - lower.air) / (upper.air - lower.air);
  const smlRank = Math.round(lower.smlRank + ratio * (upper.smlRank - lower.smlRank));
  return { estimated: true, smlRank, method: "interpolate", lower, upper };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx parse-maharashtra-registered-pdf.ts <pdf>");
    process.exit(1);
  }
  const rows = await parseMaharashtraRegisteredPdfFile(file);
  console.log(`Parsed ${rows.length} rows`);
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));
}
