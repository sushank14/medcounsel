import fs from "fs";
import path from "path";

export type MaharashtraMeritLookup = {
  smlRank: number;
  neetScore: number;
  category: string;
  categoryRaw: string;
  categoryMeritNo: number;
  candidatureType: string;
  applicationNo: string;
};

type MaharashtraMeritIndex = {
  year: number;
  round: string;
  sourceUrl: string;
  totalRows: number;
  byRoll: Record<string, MaharashtraMeritLookup>;
};

const INDEX_PATH = path.resolve(
  process.cwd(),
  "../../data/processed/maharashtra/2026-r1-merit-index.json"
);

export function loadMaharashtraMeritIndex(): MaharashtraMeritIndex | null {
  try {
    if (!fs.existsSync(INDEX_PATH)) return null;
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as MaharashtraMeritIndex;
  } catch {
    return null;
  }
}

export function lookupSmlByNeetRoll(roll: string): MaharashtraMeritLookup | null {
  const index = loadMaharashtraMeritIndex();
  if (!index) return null;
  const normalized = roll.replace(/\D/g, "");
  return index.byRoll[normalized] ?? null;
}
