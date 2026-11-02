/**
 * Mark Maharashtra colleges PRIVATE when they appear on the official R1 private seat matrix.
 */
import fs from "fs";
import path from "path";
import { prisma } from "./maharashtra-db-shared.js";
import { slugify } from "./normalizers.js";

const REPO = path.resolve(process.cwd(), "../..");
const PVT_MATRIX = path.join(REPO, "data/maharashtra/2025/processed/seat_matrix_r1_pvt.json");

type MatrixRow = { college_name_norm?: string; college_name_raw?: string };

function isValidMatrixCollegeName(raw: string): boolean {
  if (raw.length < 8 || /total avail/i.test(raw)) return false;
  if (/^\d/.test(raw)) return false;
  if (/\bMD |\bMS |Anesthesiology|Pathology\./i.test(raw) && !/medical college|hospital|institute/i.test(raw)) {
    return false;
  }
  return true;
}

export function loadMaharashtraPrivateMatrixSlugs(): Set<string> {
  if (!fs.existsSync(PVT_MATRIX)) return new Set();
  const data = JSON.parse(fs.readFileSync(PVT_MATRIX, "utf-8")) as { rows: MatrixRow[] };
  const slugs = new Set<string>();
  for (const row of data.rows ?? []) {
    const raw = (row.college_name_raw || row.college_name_norm || "").trim();
    if (!isValidMatrixCollegeName(raw)) continue;
    slugs.add(slugify(raw.split(",")[0] ?? raw));
    slugs.add(slugify(raw));
  }
  return slugs;
}

function collegeSlugs(name: string, slug: string): string[] {
  const base = slugify(name.split(",")[0] ?? name);
  return [base, slug, slugify(name)].filter(Boolean);
}

export async function syncMaharashtraCollegeTypesFromMatrices(): Promise<number> {
  const pvtSlugs = loadMaharashtraPrivateMatrixSlugs();
  console.log(`Private matrix colleges (R1): ${pvtSlugs.size} unique slugs`);

  const colleges = await prisma.college.findMany({
    where: { state: "Maharashtra", collegeType: { not: "PRIVATE" } },
    select: { id: true, name: true, slug: true, collegeType: true },
  });

  let updated = 0;
  for (const c of colleges) {
    const keys = collegeSlugs(c.name, c.slug);
    if (!keys.some((k) => pvtSlugs.has(k))) continue;
    await prisma.college.update({ where: { id: c.id }, data: { collegeType: "PRIVATE" } });
    updated++;
    if (updated <= 12) console.log(`  → PRIVATE: ${c.name.slice(0, 70)}`);
  }
  console.log(`✅ Marked ${updated} colleges PRIVATE from MAHACET R1 private matrix`);
  return updated;
}
