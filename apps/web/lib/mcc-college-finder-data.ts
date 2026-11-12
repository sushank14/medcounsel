import fs from "fs";
import path from "path";
import type { FinderRecord, FinderSource, FinderGroup, SeatCategory } from "./mcc-college-finder";

type IndexFile = { fields: string[]; records: unknown[][] };

let cache: { records: FinderRecord[]; states: string[] } | null = null;

function repoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, "../.."), path.resolve(cwd, "..")];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data/mcc/round2/college_finder_index.json"))) return root;
  }
  return path.resolve(cwd, "../..");
}

export function loadFinder(): { records: FinderRecord[]; states: string[] } {
  if (cache) return cache;
  const file = path.join(repoRoot(), "data/mcc/round2/college_finder_index.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as IndexFile;
  const records = parsed.records.map((row) => {
    const record: FinderRecord = {
      id: String(row[0]),
      source: row[1] as FinderSource,
      state: String(row[2] ?? ""),
      officialType: String(row[3] ?? ""),
      group: row[4] as FinderGroup,
      dnbKind: (row[5] || "") as FinderRecord["dnbKind"],
      degree: String(row[6] ?? ""),
      institute: String(row[7] ?? ""),
      code: String(row[8] ?? ""),
      quota: String(row[9] ?? ""),
      branch: String(row[10] ?? ""),
      branchCode: String(row[11] ?? ""),
      category: String(row[12] ?? ""),
      seatCategory: row[13] as SeatCategory,
      pwd: Boolean(row[14]),
      seats: typeof row[15] === "number" ? row[15] : null,
      page: Number(row[16] ?? 0),
      flag: String(row[17] ?? ""),
    };
    return record;
  });
  const states = [...new Set(records.map((record) => record.state).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  cache = { records, states };
  return cache;
}

export function recordsByIds(ids: string[]): FinderRecord[] {
  const wanted = new Set(ids);
  const found = new Map(loadFinder().records.filter((record) => wanted.has(record.id)).map((record) => [record.id, record]));
  return ids.map((id) => found.get(id)).filter((record): record is FinderRecord => Boolean(record));
}
