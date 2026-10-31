import { prisma } from "@medcounsel/database";
import type { Category } from "@prisma/client";

export type SeatMatrixCutoffCloses = {
  /** Maharashtra CAP — SML closing rank (2025 selection list). */
  smlClose?: number;
  /** MCC AIQ — AIR closing rank. */
  airClose?: number;
  airYear?: number;
};

type RowKey = {
  collegeId: string;
  specialtyId: string;
  category: Category;
};

function rowKey(r: RowKey): string {
  return `${r.collegeId}|${r.specialtyId}|${r.category}`;
}

/** Best (latest) R1-style closing rank per college × course × category. */
export async function loadCutoffClosesForSeatRows(
  rows: RowKey[],
  options?: { smlYear?: number; airYear?: number; includeProvisionalAiq?: boolean }
): Promise<Map<string, SeatMatrixCutoffCloses>> {
  if (!rows.length) return new Map();

  const smlYear = options?.smlYear ?? 2025;
  const airYear = options?.airYear ?? 2025;
  const collegeIds = [...new Set(rows.map((r) => r.collegeId))];
  const specialtyIds = [...new Set(rows.map((r) => r.specialtyId))];
  const categories = [...new Set(rows.map((r) => r.category))];

  const [mhCutoffs, aiqFinal, aiqProv] = await Promise.all([
    prisma.cutoff.findMany({
      where: {
        collegeId: { in: collegeIds },
        specialtyId: { in: specialtyIds },
        category: { in: categories },
        year: smlYear,
        counselling: { code: "MAHARASHTRA" },
        rankType: "SML",
      },
      select: { collegeId: true, specialtyId: true, category: true, closingRank: true, round: { select: { round: true } } },
      orderBy: [{ year: "desc" }, { closingRank: "desc" }],
    }),
    prisma.cutoff.findMany({
      where: {
        collegeId: { in: collegeIds },
        specialtyId: { in: specialtyIds },
        category: { in: categories },
        year: airYear,
        counselling: { code: "AIQ" },
        rankType: "AIR",
        verificationStatus: "VERIFIED",
      },
      select: { collegeId: true, specialtyId: true, category: true, closingRank: true, round: { select: { round: true } } },
      orderBy: [{ closingRank: "desc" }],
    }),
    options?.includeProvisionalAiq
      ? prisma.cutoff.findMany({
          where: {
            collegeId: { in: collegeIds },
            specialtyId: { in: specialtyIds },
            category: { in: categories },
            year: 2026,
            counselling: { code: "AIQ" },
            rankType: "AIR",
            verificationStatus: "NEEDS_REVIEW",
          },
          select: {
            collegeId: true,
            specialtyId: true,
            category: true,
            closingRank: true,
            year: true,
            round: { select: { round: true } },
          },
          orderBy: [{ closingRank: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const out = new Map<string, SeatMatrixCutoffCloses>();

  const pickClose = (
    list: typeof mhCutoffs,
    key: string,
    field: "smlClose" | "airClose",
    year?: number
  ) => {
    const [collegeId, specialtyId, category] = key.split("|");
    const matches = list.filter(
      (c) => c.collegeId === collegeId && c.specialtyId === specialtyId && c.category === category
    );
    if (!matches.length) return;
    const r1 = matches.filter((m) => m.round?.round === "R1");
    const pool = r1.length ? r1 : matches;
    const closingRank = Math.max(...pool.map((m) => m.closingRank));
    const existing = out.get(key) ?? {};
    existing[field] = closingRank;
    if (field === "airClose" && year) existing.airYear = year;
    out.set(key, existing);
  };

  for (const r of rows) {
    const key = rowKey(r);
    if (!out.has(key)) out.set(key, {});
  }

  for (const key of out.keys()) {
    pickClose(mhCutoffs, key, "smlClose");
    pickClose(aiqFinal, key, "airClose", airYear);
  }

  for (const c of aiqProv) {
    const key = `${c.collegeId}|${c.specialtyId}|${c.category}`;
    const existing = out.get(key) ?? {};
    if (existing.airClose === undefined) {
      existing.airClose = c.closingRank;
      existing.airYear = c.year;
      out.set(key, existing);
    }
  }

  return out;
}
