/**
 * Import NMC/MARB PG Seat Matrix AY 2026–27 from parsed JSON.
 * Run parser first: python3 packages/data-ingestion/scripts/parse-nmc-seat-matrix.py <pdf>
 *
 * Usage: npx tsx src/import-nmc-seat-matrix-2026.ts [--dry-run]
 */
import fs from "fs";
import path from "path";
import { prisma, CollegeType, DataStatus, Degree, Category, Quota } from "@medcounsel/database";
import { displayCollegeName, displayCity } from "../../types/src/college-display.js";
import { parseCourse, slugify } from "./normalizers.js";

const MATRIX_YEAR = 2026;
const ACADEMIC_YEAR = "2026-27";
const JSON_PATH = path.resolve(process.cwd(), "../../data/processed/nmc/2026-27-seat-matrix.json");
const DRY_RUN = process.argv.includes("--dry-run");

interface NmcRow {
  collegeCode: string;
  state: string;
  collegeName: string;
  category: string;
  courseName: string;
  seats: number | null;
  academicYear: string;
  matrixYear: number;
}

interface NmcPayload {
  source: {
    authority: string;
    title: string;
    publishedDate: string;
    academicYear: string;
    matrixYear: number;
  };
  rows: NmcRow[];
  validation: Record<string, unknown>;
}

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

const CATEGORY_TO_TYPE: Record<string, CollegeType> = {
  GOVT: "GOVT",
  PRIVATE: "PRIVATE",
  DEEMED: "DEEMED",
};

const specialtyCache = new Map<string, string>();
const collegeCache = new Map<string, string>();

function mapState(state: string): string {
  const fixes: Record<string, string> = {
    "Andaman Nicobar Islands": "Andaman And Nicobar Islands",
    "Jammu & Kashmir": "Jammu And Kashmir",
    "Orissa": "Odisha",
  };
  return fixes[state] ?? state;
}

function collegeTypeFromRow(row: NmcRow): CollegeType {
  return CATEGORY_TO_TYPE[row.category] ?? "GOVT";
}

async function ensureSource() {
  const title = "NMC/MARB PG Seat Matrix for Academic Year 2026–27";
  const existing = await prisma.source.findFirst({ where: { title } });
  if (existing) {
    return prisma.source.update({
      where: { id: existing.id },
      data: {
        lastVerifiedDate: new Date(),
        dataYear: MATRIX_YEAR,
        publishedDate: new Date("2026-09-29"),
      },
    });
  }
  return prisma.source.create({
    data: {
      authority: "NMC",
      title,
      url: "https://www.nmc.org.in/",
      publishedDate: new Date("2026-09-29"),
      lastVerifiedDate: new Date(),
      dataYear: MATRIX_YEAR,
      sourceType: "OFFICIAL",
      trustLevel: "PRIMARY",
    },
  });
}

async function ensureSpecialty(courseName: string) {
  const { degree, specialty } = parseCourse(courseName);
  /** Official NMC course title — shared across colleges (e.g. all "M.D. General Medicine"). */
  const slug = slugify(courseName).slice(0, 80);
  if (specialtyCache.has(slug)) return specialtyCache.get(slug)!;

  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) {
    specialtyCache.set(slug, existing.id);
    return existing.id;
  }

  const created = await prisma.specialty.create({
    data: {
      name: specialty.slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug,
      category: "CLINICAL",
    },
  });
  specialtyCache.set(slug, created.id);
  return created.id;
}

async function ensureCollege(row: NmcRow): Promise<string> {
  if (collegeCache.has(row.collegeCode)) return collegeCache.get(row.collegeCode)!;

  const state = mapState(row.state);
  const name = displayCollegeName(row.collegeName);
  const collegeType = collegeTypeFromRow(row);

  const byCode = await prisma.college.findFirst({ where: { nmcId: row.collegeCode } });
  if (byCode) {
    collegeCache.set(row.collegeCode, byCode.id);
    if (!DRY_RUN) {
      await prisma.college.update({
        where: { id: byCode.id },
        data: {
          dataStatus: DataStatus.OFFICIAL,
          state: byCode.state === "Unknown" ? state : byCode.state,
          collegeType,
        },
      });
    }
    return byCode.id;
  }

  const slugBase = slugify(name.split(",")[0]);
  let slug = slugBase;
  let n = 1;
  while (await prisma.college.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${n++}`;
  }

  /** Exact name match only — avoid merging distinct NMC college codes. */
  const byExactName = await prisma.college.findFirst({
    where: { name: { equals: name }, state },
  });

  if (byExactName && !byExactName.nmcId) {
    collegeCache.set(row.collegeCode, byExactName.id);
    if (!DRY_RUN) {
      await prisma.college.update({
        where: { id: byExactName.id },
        data: {
          nmcId: row.collegeCode,
          dataStatus: DataStatus.OFFICIAL,
          collegeType,
        },
      });
    }
    return byExactName.id;
  }

  if (DRY_RUN) {
    const fakeId = `dry-${row.collegeCode}`;
    collegeCache.set(row.collegeCode, fakeId);
    return fakeId;
  }

  const created = await prisma.college.create({
    data: {
      name,
      shortName: name.slice(0, 60),
      slug,
      state,
      city: displayCity(name),
      collegeType,
      nmcId: row.collegeCode,
      dataStatus: DataStatus.OFFICIAL,
    },
  });
  collegeCache.set(row.collegeCode, created.id);
  return created.id;
}

async function upsertSeatMatrix(
  collegeId: string,
  specialtyId: string,
  seats: number,
  sourceId: string
) {
  if (DRY_RUN || collegeId.startsWith("dry-")) return;

  const existing = await prisma.seatMatrix.findFirst({
    where: {
      collegeId,
      specialtyId,
      year: MATRIX_YEAR,
      category: Category.GENERAL,
      quota: Quota.AIQ,
    },
  });

  if (existing) {
    await prisma.seatMatrix.update({
      where: { id: existing.id },
      data: { seats, sourceId },
    });
    return;
  }

  await prisma.seatMatrix.create({
    data: {
      collegeId,
      specialtyId,
      year: MATRIX_YEAR,
      category: Category.GENERAL,
      quota: Quota.AIQ,
      seats,
      sourceId,
    },
  });
}

async function syncCollegeSpecialtySeats(collegeIds: string[]) {
  if (DRY_RUN) return;

  for (const collegeId of collegeIds) {
    const matrixRows = await prisma.seatMatrix.findMany({
      where: { collegeId, year: MATRIX_YEAR },
      select: { specialtyId: true, seats: true },
    });

    const bySpecialty = new Map<string, number>();
    for (const row of matrixRows) {
      bySpecialty.set(row.specialtyId, (bySpecialty.get(row.specialtyId) ?? 0) + row.seats);
    }

    for (const [specialtyId, seats] of bySpecialty) {
      await prisma.collegeSpecialty.upsert({
        where: { collegeId_specialtyId: { collegeId, specialtyId } },
        update: { totalSeats: seats },
        create: { collegeId, specialtyId, totalSeats: seats },
      });
    }
  }
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Missing ${JSON_PATH}. Run parse-nmc-seat-matrix.py first.`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as NmcPayload;
  const rows = payload.rows.filter((r) => r.seats !== null && r.seats >= 0);

  console.log(`📥 Importing NMC PG Seat Matrix ${ACADEMIC_YEAR}${DRY_RUN ? " (dry run)" : ""}...`);
  console.log(`   Records: ${rows.length} (${payload.rows.length - rows.length} skipped — missing/invalid seats)`);

  if (!DRY_RUN) {
    const removed = await prisma.seatMatrix.deleteMany({ where: { year: MATRIX_YEAR } });
    console.log(`   Cleared ${removed.count} existing SeatMatrix rows for year ${MATRIX_YEAR}`);
  }

  const source = DRY_RUN ? { id: "dry-source" } : await ensureSource();

  let imported = 0;
  let skipped = 0;
  const collegeIds = new Set<string>();

  for (const row of rows) {
    if (row.academicYear !== ACADEMIC_YEAR) {
      skipped++;
      continue;
    }

    const collegeId = await ensureCollege(row);
    collegeIds.add(collegeId);
    const specialtyId = await ensureSpecialty(row.courseName);

    if (!DRY_RUN && !collegeId.startsWith("dry-")) {
      await upsertSeatMatrix(collegeId, specialtyId, row.seats!, source.id);
    }
    imported++;
  }

  await syncCollegeSpecialtySeats([...collegeIds]);

  const matrixCount = DRY_RUN
    ? imported
    : await prisma.seatMatrix.count({ where: { year: MATRIX_YEAR } });

  console.log(`\n✅ Import complete`);
  console.log(`   Programs imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Colleges touched: ${collegeIds.size}`);
  console.log(`   SeatMatrix rows (year ${MATRIX_YEAR}): ${matrixCount.toLocaleString()}`);

  if (payload.validation) {
    console.log(`\n📋 Validation summary (from extraction):`);
    console.log(`   Total seats: ${(payload.validation as { totalSeats?: number }).totalSeats?.toLocaleString()}`);
    console.log(`   Unique colleges: ${(payload.validation as { uniqueCollegeCodes?: number }).uniqueCollegeCodes}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
