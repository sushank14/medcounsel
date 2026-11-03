import fs from "fs";
import path from "path";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Minimal abbrev expansion for MAHACET matrix college headers */
function normalizeCollegeHeader(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes("GRANT") && u.includes("MUMBAI")) return "Grant Medical College, Mumbai";
  if (u.startsWith("SETH G")) return raw.replace(/\s+/g, " ").trim();
  return raw.replace(/\s+/g, " ").trim();
}

export type MahSeatRow = {
  college_name_raw?: string;
  college_name_norm?: string;
  branch_name_norm?: string;
  branch_name_raw?: string;
  degree?: string;
  category?: string;
  seat_type?: string;
  seat_count?: number;
  quota?: string;
  source_page?: number;
};

export type CompareStatus =
  | "increased"
  | "decreased"
  | "unchanged"
  | "new"
  | "removed"
  | "needs_review";

export type MahSeatCompareRow = {
  college: string;
  collegeKey: string;
  branch: string;
  branchKey: string;
  degree: string;
  category: string;
  quota: string;
  seats2025: number | null;
  seats2026: number | null;
  change: number | null;
  changePct: number | null;
  status: CompareStatus;
};

export type MahSeatCompareSummary = {
  yearA: number;
  yearB: number;
  matrixKey: string;
  totalSeatsA: number;
  totalSeatsB: number;
  netChange: number;
  collegesIncreased: number;
  collegesDecreased: number;
  collegesNew: number;
  collegesRemoved: number;
  rowsCompared: number;
  sourceA?: { url?: string; title?: string };
  sourceB?: { url?: string; title?: string };
};

const REPO = path.resolve(process.cwd(), "../..");

function matrixPath(year: number, key: string): string[] {
  return [
    path.join(REPO, `data/maharashtra/${year}/processed/${key}.json`),
    path.join(REPO, `data/maharashtra/${year}/processed/seat_matrix_r1_govt.json`),
  ];
}

export function loadMahSeatMatrixJson(
  year: number,
  key = "seat_matrix_r1_govt"
): { meta: Record<string, unknown>; rows: MahSeatRow[] } | null {
  for (const p of matrixPath(year, key)) {
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, "utf-8")) as {
      meta?: Record<string, unknown>;
      rows: MahSeatRow[];
    };
    return { meta: data.meta ?? { year }, rows: data.rows ?? [] };
  }
  return null;
}

function collegeKey(name: string): string {
  const expanded = normalizeCollegeHeader(name);
  return slugify(expanded.split(",")[0] ?? expanded);
}

function branchKey(row: MahSeatRow): string {
  const branch = row.branch_name_norm || row.branch_name_raw || "unknown";
  const degree = row.degree ?? "MD";
  return slugify(`${degree}-${branch}`);
}

function rowKey(row: MahSeatRow): string {
  const quota = row.quota ?? (row.seat_type?.includes("INS") ? "IN_SERVICE" : "STATE");
  return [
    collegeKey(row.college_name_norm || row.college_name_raw || ""),
    branchKey(row),
    row.category ?? "OPEN",
    quota,
  ].join("|");
}

function isValidCollegeName(name: string): boolean {
  if (name.length < 12) return false;
  if (/^\d+(MD|MS)\s/i.test(name)) return false;
  if (/seat position|allotment of above|muhs nashik/i.test(name)) return false;
  return /medical college|hospital|institute|rehabilitation|aiipmr|municipal|muncipal/i.test(name);
}

function aggregate(rows: MahSeatRow[]): Map<string, { seats: number; sample: MahSeatRow }> {
  const map = new Map<string, { seats: number; sample: MahSeatRow }>();
  for (const r of rows) {
    const n = r.seat_count ?? 0;
    const college = r.college_name_norm || r.college_name_raw || "";
    if (n <= 0 || !isValidCollegeName(college)) continue;
    const k = rowKey(r);
    const prev = map.get(k);
    if (prev) prev.seats += n;
    else map.set(k, { seats: n, sample: r });
  }
  return map;
}

function classify(a: number | null, b: number | null): CompareStatus {
  if (a == null && b != null) return "new";
  if (a != null && b == null) return "removed";
  if (a == null || b == null) return "needs_review";
  if (b > a) return "increased";
  if (b < a) return "decreased";
  return "unchanged";
}

export function compareMaharashtraSeatMatrices(
  yearA: number,
  yearB: number,
  matrixKey = "seat_matrix_r1_govt"
): { summary: MahSeatCompareSummary; rows: MahSeatCompareRow[] } | null {
  const packA = loadMahSeatMatrixJson(yearA, matrixKey);
  const packB = loadMahSeatMatrixJson(yearB, matrixKey);
  if (!packA?.rows.length || !packB?.rows.length) return null;

  const mapA = aggregate(packA.rows);
  const mapB = aggregate(packB.rows);
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);

  const rows: MahSeatCompareRow[] = [];
  let totalA = 0;
  let totalB = 0;
  for (const [, v] of mapA) totalA += v.seats;
  for (const [, v] of mapB) totalB += v.seats;

  const collegeDelta = new Map<string, number>();

  for (const k of keys) {
    const la = mapA.get(k);
    const lb = mapB.get(k);
    const seatsA = la?.seats ?? null;
    const seatsB = lb?.seats ?? null;
    const sample = lb?.sample ?? la!.sample;
    const status = classify(seatsA, seatsB);
    const change = seatsA != null && seatsB != null ? seatsB - seatsA : null;
    const changePct =
      change != null && seatsA != null && seatsA > 0 ? (change / seatsA) * 100 : null;

    const cKey = collegeKey(sample.college_name_norm || sample.college_name_raw || "");
    if (change != null) collegeDelta.set(cKey, (collegeDelta.get(cKey) ?? 0) + change);

    rows.push({
      college: sample.college_name_norm || sample.college_name_raw || "Unknown",
      collegeKey: cKey,
      branch: sample.branch_name_norm || sample.branch_name_raw || "Unknown",
      branchKey: branchKey(sample),
      degree: sample.degree ?? "MD",
      category: sample.category ?? "OPEN",
      quota: sample.quota ?? "STATE",
      seats2025: seatsA,
      seats2026: seatsB,
      change,
      changePct,
      status,
    });
  }

  rows.sort((a, b) => Math.abs((b.change ?? 0)) - Math.abs((a.change ?? 0)));

  let collegesIncreased = 0;
  let collegesDecreased = 0;
  for (const d of collegeDelta.values()) {
    if (d > 0) collegesIncreased++;
    else if (d < 0) collegesDecreased++;
  }

  const collegeKeysA = new Set([...mapA.keys()].map((k) => k.split("|")[0]));
  const collegeKeysB = new Set([...mapB.keys()].map((k) => k.split("|")[0]));
  let collegesNew = 0;
  let collegesRemoved = 0;
  for (const c of collegeKeysB) if (!collegeKeysA.has(c)) collegesNew++;
  for (const c of collegeKeysA) if (!collegeKeysB.has(c)) collegesRemoved++;

  return {
    summary: {
      yearA,
      yearB,
      matrixKey,
      totalSeatsA: totalA,
      totalSeatsB: totalB,
      netChange: totalB - totalA,
      collegesIncreased,
      collegesDecreased,
      collegesNew,
      collegesRemoved,
      rowsCompared: rows.length,
      sourceA: packA.meta as { url?: string; title?: string },
      sourceB: packB.meta as { url?: string; title?: string },
    },
    rows,
  };
}

export type MahCollegeCompareRow = {
  college: string;
  collegeKey: string;
  seatsA: number;
  seatsB: number;
  change: number;
};

export type MahBranchCompareRow = {
  branch: string;
  branchKey: string;
  degree: string;
  seatsA: number;
  seatsB: number;
  change: number;
  collegesA: number;
  collegesB: number;
};

export function aggregateCompareByCollege(rows: MahSeatCompareRow[]): MahCollegeCompareRow[] {
  const map = new Map<string, MahCollegeCompareRow>();
  for (const r of rows) {
    const prev = map.get(r.collegeKey) ?? {
      college: r.college,
      collegeKey: r.collegeKey,
      seatsA: 0,
      seatsB: 0,
      change: 0,
    };
    prev.seatsA += r.seats2025 ?? 0;
    prev.seatsB += r.seats2026 ?? 0;
    prev.change = prev.seatsB - prev.seatsA;
    map.set(r.collegeKey, prev);
  }
  return [...map.values()].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

type BranchAgg = {
  branch: string;
  branchKey: string;
  degree: string;
  seatsA: number;
  seatsB: number;
  change: number;
  collegesA: Set<string>;
  collegesB: Set<string>;
};

export function aggregateCompareByBranch(rows: MahSeatCompareRow[]): MahBranchCompareRow[] {
  const map = new Map<string, BranchAgg>();
  for (const r of rows) {
    const prev = map.get(r.branchKey) ?? {
      branch: r.branch,
      branchKey: r.branchKey,
      degree: r.degree,
      seatsA: 0,
      seatsB: 0,
      change: 0,
      collegesA: new Set<string>(),
      collegesB: new Set<string>(),
    };
    if (r.seats2025 != null) prev.collegesA.add(r.collegeKey);
    if (r.seats2026 != null) prev.collegesB.add(r.collegeKey);
    prev.seatsA += r.seats2025 ?? 0;
    prev.seatsB += r.seats2026 ?? 0;
    prev.change = prev.seatsB - prev.seatsA;
    map.set(r.branchKey, prev);
  }
  return [...map.values()]
    .map(({ collegesA, collegesB, ...rest }) => ({
      ...rest,
      collegesA: collegesA.size,
      collegesB: collegesB.size,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function mahSeatCompareRowsToCsv(rows: MahSeatCompareRow[]): string {
  const header = "College,Branch,Degree,Category,Quota,Seats2025,Seats2026,Change,ChangePct,Status";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      esc(r.college),
      esc(r.branch),
      r.degree,
      r.category,
      r.quota,
      r.seats2025 ?? "",
      r.seats2026 ?? "",
      r.change ?? "",
      r.changePct != null ? r.changePct.toFixed(1) : "",
      r.status,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}
