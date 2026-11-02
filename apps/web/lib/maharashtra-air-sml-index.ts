import fs from "fs";
import path from "path";

export type MaharashtraAirSmlLookup = {
  smlRank: number;
  neetRoll: string;
  neetScore: number;
  category: string;
  categoryRaw: string;
};

export type MaharashtraAirSmlIndexFile = {
  year: number;
  listLabel: string;
  sourceUrl: string;
  generatedAt: string;
  totalRows: number;
  byAir: Record<string, MaharashtraAirSmlLookup>;
  byRoll: Record<string, { air: number; smlRank: number }>;
};

const INDEX_CANDIDATES = [
  "2025-reg-cap3-air-sml-index.json",
  "2026-r1-merit-index.json", // fallback metadata only
];

function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

function indexPaths(file: string): string[] {
  const root = repoRoot();
  return [
    path.join(root, "data/maharashtra/2025/processed", file),
    path.join(root, "data/processed/maharashtra", file),
  ];
}

function processedDir(): string {
  const primary = path.join(repoRoot(), "data/processed/maharashtra");
  if (fs.existsSync(primary)) return primary;
  return path.join(repoRoot(), "data/maharashtra/2025/processed");
}

export function loadMaharashtraAirSmlIndex(): MaharashtraAirSmlIndexFile | null {
  for (const file of INDEX_CANDIDATES) {
    if (!file.includes("air-sml")) continue;
    for (const full of indexPaths(file)) {
      try {
        if (!fs.existsSync(full)) continue;
        return JSON.parse(fs.readFileSync(full, "utf8")) as MaharashtraAirSmlIndexFile;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function lookupByAir(air: number): {
  found: boolean;
  estimated: boolean;
  air: number;
  smlRank: number;
  data?: MaharashtraAirSmlLookup;
  lower?: { air: number; smlRank: number };
  upper?: { air: number; smlRank: number };
  index: MaharashtraAirSmlIndexFile | null;
} {
  const index = loadMaharashtraAirSmlIndex();
  if (!index) {
    return { found: false, estimated: true, air, smlRank: 0, index: null };
  }

  const exact = index.byAir[String(air)];
  if (exact) {
    return {
      found: true,
      estimated: false,
      air,
      smlRank: exact.smlRank,
      data: exact,
      index,
    };
  }

  const pairs = Object.entries(index.byAir)
    .map(([a, v]) => ({ air: parseInt(a, 10), smlRank: v.smlRank }))
    .sort((x, y) => x.air - y.air);

  if (pairs.length === 0) {
    return { found: false, estimated: true, air, smlRank: 0, index };
  }

  let lower = pairs[0]!;
  let upper = pairs[pairs.length - 1]!;
  for (const p of pairs) {
    if (p.air <= air) lower = p;
    if (p.air >= air) {
      upper = p;
      break;
    }
  }

  if (air <= lower.air) {
    return { found: false, estimated: true, air, smlRank: lower.smlRank, lower, upper: lower, index };
  }
  if (air >= upper.air) {
    return { found: false, estimated: true, air, smlRank: upper.smlRank, lower: upper, upper, index };
  }

  const ratio = (air - lower.air) / (upper.air - lower.air);
  const smlRank = Math.round(lower.smlRank + ratio * (upper.smlRank - lower.smlRank));
  return { found: false, estimated: true, air, smlRank, lower, upper, index };
}

export function loadMeritIndexMeta(): { year: number; round: string; sourceUrl: string; totalRows: number }[] {
  const dir = processedDir();
  const out: { year: number; round: string; sourceUrl: string; totalRows: number }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith("-merit-index.json")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as {
        year: number;
        round: string;
        sourceUrl: string;
        totalRows: number;
      };
      out.push(j);
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => a.year - b.year || a.round.localeCompare(b.round));
}
