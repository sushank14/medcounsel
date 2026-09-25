/**
 * Re-import cutoffs for colleges that have specialties but missing cutoff rows
 * (fixes GGMC-style abbrev mismatches after matching logic improvements).
 *
 * Run: npm run relink-cutoffs --workspace=@medcounsel/data-ingestion
 */
import fs from "fs";
import path from "path";
import { PrismaClient, Category, Quota, Degree, VerificationStatus } from "@prisma/client";
import type { CutoffAggregate } from "./parse-mcc-pdf.js";
import { slugify, extractInstituteCode } from "./normalizers.js";
import { displayCollegeName, displayCity } from "../../types/src/college-display.js";

const prisma = new PrismaClient();
const PROCESSED_MCC = path.resolve(process.cwd(), "../../data/processed/mcc");
const PROCESSED_MH = path.resolve(process.cwd(), "../../data/processed/maharashtra");

const CATEGORY_MAP: Record<string, Category> = {
  GENERAL: "GENERAL",
  EWS: "EWS",
  OBC: "OBC",
  SC: "SC",
  ST: "ST",
  PWD: "PWD",
};

const QUOTA_MAP: Record<string, Quota> = {
  AIQ: "AIQ",
  STATE: "STATE",
  NRI: "NRI",
  MANAGEMENT: "MANAGEMENT",
  IQ: "IQ",
};

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

function instituteTitle(name: string): string {
  const parts = name.replace(/\(\d{5,7}\)\s*$/, "").split(",").map((p) => p.trim());
  const head =
    parts.length >= 2 && !/\d{5}/.test(parts[1])
      ? `${parts[0]}, ${parts[1].replace(/\d+.*/, "").trim()}`
      : parts[0];
  return displayCollegeName(head);
}

async function resolveCollegeId(institute: string, stateHint?: string): Promise<string | null> {
  const code = extractInstituteCode(institute);
  const cleanName = instituteTitle(institute);
  const city = displayCity(institute.split(",")[1]?.trim() ?? "");

  if (code) {
    const byCode = await prisma.college.findFirst({ where: { nmcId: code } });
    if (byCode) return byCode.id;
  }

  const found = await prisma.college.findFirst({
    where: {
      OR: [
        { name: cleanName },
        { slug: slugify(cleanName) },
        { slug: "ggmc", name: { contains: "GGMC" } },
        {
          AND: [
            { state: stateHint ?? "Maharashtra" },
            ...(city ? [{ city: { contains: city.slice(0, 12) } }] : []),
            { name: { contains: cleanName.split(",")[0].slice(0, 18) } },
          ],
        },
      ],
    },
  });

  if (found) {
    await prisma.college.update({
      where: { id: found.id },
      data: {
        name: cleanName,
        shortName: cleanName.slice(0, 60),
        ...(code ? { nmcId: code } : {}),
        ...(city && found.city.length > 35 ? { city } : {}),
      },
    });
    return found.id;
  }

  return null;
}

async function ensureSpecialty(degree: string, specialty: string, slug: string) {
  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const spec = await prisma.specialty.create({
    data: {
      name: specialty.slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug,
      category: "CLINICAL",
    },
  });
  return spec.id;
}

async function importMccJsonFile(file: string, counsellingId: string, sourceId: string) {
  const rows = JSON.parse(fs.readFileSync(path.join(PROCESSED_MCC, file), "utf8")) as CutoffAggregate[];
  const round = file.replace(/^\d+-(.+)\.json$/, "$1").replace("-cutoffs", "");
  const year = parseInt(file.slice(0, 4), 10);

  const roundRec = await prisma.counsellingRound.upsert({
    where: { counsellingId_year_round: { counsellingId, year, round: round as "R1" } },
    update: {},
    create: { counsellingId, year, round: round as "R1" },
  });

  let linked = 0;
  for (const row of rows) {
    if (!row.institute?.toLowerCase().includes("gondia")) continue;

    const collegeId = await resolveCollegeId(row.institute);
    if (!collegeId) continue;

    const existingCutoffs = await prisma.cutoff.count({ where: { collegeId } });
    if (existingCutoffs > 0 && row.instituteNorm === "government medical college") {
      /* only fill orphans */
    }

    const specialtyId = await ensureSpecialty(row.degree, row.specialty, row.specialtySlug);

    const dup = await prisma.cutoff.findFirst({
      where: {
        collegeId,
        specialtyId,
        counsellingId,
        roundId: roundRec.id,
        year,
        category: CATEGORY_MAP[row.category] ?? "GENERAL",
        quota: QUOTA_MAP[row.quota] ?? "AIQ",
        closingRank: row.closingRank,
      },
    });
    if (dup) continue;

    await prisma.cutoff.create({
      data: {
        collegeId,
        specialtyId,
        counsellingId,
        roundId: roundRec.id,
        year,
        category: CATEGORY_MAP[row.category] ?? "GENERAL",
        quota: QUOTA_MAP[row.quota] ?? "AIQ",
        openingRank: row.openingRank,
        closingRank: row.closingRank,
        rankType: "AIR",
        seats: row.seats,
        sourceId,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    linked++;
  }
  return linked;
}

async function importMaharashtraJson() {
  const counselling = await prisma.counselling.findUnique({ where: { code: "MAHARASHTRA" } });
  if (!counselling) return 0;

  let linked = 0;
  if (!fs.existsSync(PROCESSED_MH)) return 0;

  for (const file of fs.readdirSync(PROCESSED_MH).filter((f) => f.endsWith(".json"))) {
    const rows = JSON.parse(fs.readFileSync(path.join(PROCESSED_MH, file), "utf8")) as Array<{
      collegeNorm: string;
      city: string;
      subject: string;
      degree: string;
      specialtySlug: string;
      category: string;
      closingRank: number;
      year: number;
      round: string;
    }>;

    for (const row of rows) {
      if (row.collegeNorm !== "government-medical-college-gondia" && row.city !== "Gondia") continue;

      const collegeId = await resolveCollegeId(`Government Medical College, ${row.city}`, "Maharashtra");
      if (!collegeId) continue;

      const roundRec = await prisma.counsellingRound.upsert({
        where: {
          counsellingId_year_round: {
            counsellingId: counselling.id,
            year: row.year,
            round: row.round as "R1",
          },
        },
        update: {},
        create: {
          counsellingId: counselling.id,
          year: row.year,
          round: row.round as "R1",
        },
      });

      const specialtyId = await ensureSpecialty(
        row.degree,
        row.subject.replace(/^(MD|MS)\s*/i, ""),
        row.specialtySlug
      );

      const dup = await prisma.cutoff.findFirst({
        where: {
          collegeId,
          specialtyId,
          counsellingId: counselling.id,
          roundId: roundRec.id,
          year: row.year,
          closingRank: row.closingRank,
          rankType: "SML",
        },
      });
      if (dup) continue;

      await prisma.cutoff.create({
        data: {
          collegeId,
          specialtyId,
          counsellingId: counselling.id,
          roundId: roundRec.id,
          year: row.year,
          category: CATEGORY_MAP[row.category] ?? "GENERAL",
          quota: "STATE",
          closingRank: row.closingRank,
          rankType: "SML",
          verificationStatus: VerificationStatus.VERIFIED,
        },
      });
      linked++;
    }
  }
  return linked;
}

async function main() {
  await prisma.college.updateMany({
    where: { slug: "ggmc" },
    data: {
      name: "Government Medical College, Gondia",
      shortName: "Government Medical College, Gondia",
      city: "Gondia",
    },
  });

  const aiq = await prisma.counselling.findUnique({ where: { code: "AIQ" } });
  const source = await prisma.source.findFirst({ where: { authority: "MCC" } });

  let mccLinked = 0;
  if (aiq && source && fs.existsSync(PROCESSED_MCC)) {
    for (const file of fs.readdirSync(PROCESSED_MCC).filter((f) => f.endsWith("-cutoffs.json"))) {
      mccLinked += await importMccJsonFile(file, aiq.id, source.id);
    }
  }

  const mhLinked = await importMaharashtraJson();
  const ggmcCutoffs = await prisma.cutoff.count({
    where: { collegeId: (await prisma.college.findFirst({ where: { slug: "ggmc" } }))?.id ?? "" },
  });

  console.log(`✅ Gondia relink: MCC ${mccLinked}, Maharashtra ${mhLinked}. GGMC cutoffs now: ${ggmcCutoffs}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
