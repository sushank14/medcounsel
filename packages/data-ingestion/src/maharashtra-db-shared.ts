import {
  PrismaClient,
  Category,
  Quota,
  Degree,
  DataStatus,
  VerificationStatus,
  DocType,
  CollegeType,
} from "@prisma/client";
import { slugify } from "./normalizers.js";
import type { MahCutoffAggregate } from "./parse-maharashtra-pdf.js";
import { inferCollegeTypeFromName } from "../../types/src/college-type.js";

export const prisma = new PrismaClient();

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

const CATEGORY_MAP: Record<string, Category> = {
  GENERAL: "GENERAL",
  OPEN: "GENERAL",
  EWS: "EWS",
  OBC: "OBC",
  SEBC: "OBC",
  SC: "SC",
  ST: "ST",
  PWD: "PWD",
  VJ: "OBC",
  NT1: "OBC",
  NT2: "OBC",
  NT3: "OBC",
};

const collegeCache = new Map<string, string>();
const specialtyCache = new Map<string, string>();

export function mapMahCategory(raw: string): Category {
  return CATEGORY_MAP[raw.toUpperCase()] ?? "GENERAL";
}

export async function ensureMaharashtraCounselling() {
  return prisma.counselling.upsert({
    where: { code: "MAHARASHTRA" },
    update: {},
    create: {
      code: "MAHARASHTRA",
      name: "Maharashtra State NEET-PG Counselling",
      type: "STATE",
      authority: "State CET Cell, Maharashtra",
      portalUrl: "https://medicalug2025.mahacet.org/NEET-PGM-2025/login",
      rankType: "SML",
    },
  });
}

export async function ensureMahRound(counsellingId: string, year: number, round: "R1" | "R2" | "R3") {
  return prisma.counsellingRound.upsert({
    where: { counsellingId_year_round: { counsellingId, year, round } },
    update: {},
    create: { counsellingId, year, round },
  });
}

function inferCollegeType(name: string): CollegeType {
  return inferCollegeTypeFromName(name) as CollegeType;
}

export async function ensureMahCollege(name: string, city: string, collegeNorm: string) {
  const key = collegeNorm || slugify(name);
  if (collegeCache.has(key)) return collegeCache.get(key)!;

  const slugBase = slugify(name.split(",")[0]);
  let slug = slugBase;
  let n = 1;
  while (await prisma.college.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${n++}`;
  }

  const exactName = name.split(",")[0].trim();
  const existing = await prisma.college.findFirst({
    where: {
      state: "Maharashtra",
      OR: [{ slug: slugBase }, { name: exactName }, { slug: { contains: key.slice(0, 24) } }],
    },
  });

  if (existing) {
    const typed = inferCollegeType(name);
    if (existing.collegeType !== typed) {
      await prisma.college.update({
        where: { id: existing.id },
        data: { collegeType: typed },
      });
    }
    collegeCache.set(key, existing.id);
    return existing.id;
  }

  const college = await prisma.college.create({
    data: {
      name: name.slice(0, 200),
      shortName: exactName.slice(0, 60),
      slug,
      state: "Maharashtra",
      city: (city || "Maharashtra").slice(0, 60),
      collegeType: inferCollegeType(name),
      dataStatus: DataStatus.OFFICIAL,
    },
  });
  collegeCache.set(key, college.id);
  return college.id;
}

export async function ensureMahSpecialty(degree: string, subject: string, specialtySlug: string) {
  if (specialtyCache.has(specialtySlug)) return specialtyCache.get(specialtySlug)!;

  const existing = await prisma.specialty.findUnique({ where: { slug: specialtySlug } });
  if (existing) {
    specialtyCache.set(specialtySlug, existing.id);
    return existing.id;
  }

  const spec = await prisma.specialty.create({
    data: {
      name: subject.slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug: specialtySlug,
      category: "CLINICAL",
    },
  });
  specialtyCache.set(specialtySlug, spec.id);
  return spec.id;
}

export async function importMahCutoffBatch(
  cutoffs: MahCutoffAggregate[],
  counsellingId: string,
  roundId: string,
  sourceId: string,
  year: number
) {
  let imported = 0;
  const batch: Parameters<typeof prisma.cutoff.create>[0]["data"][] = [];

  for (const c of cutoffs) {
    if (c.year !== year) continue;
    const collegeId = await ensureMahCollege(c.college, c.city, c.collegeNorm);
    const specialtyId = await ensureMahSpecialty(c.degree, c.subject, c.specialtySlug);

    await prisma.collegeSpecialty.upsert({
      where: { collegeId_specialtyId: { collegeId, specialtyId } },
      update: { totalSeats: { set: Math.max(c.seats, 0) } },
      create: { collegeId, specialtyId, totalSeats: c.seats },
    });

    batch.push({
      collegeId,
      specialtyId,
      counsellingId,
      roundId,
      year: c.year,
      category: CATEGORY_MAP[c.category] ?? "GENERAL",
      quota: "STATE" as Quota,
      openingRank: c.openingRank,
      closingRank: c.closingRank,
      rankType: "SML",
      seats: c.seats,
      sourceId,
      verificationStatus: VerificationStatus.PENDING,
    });
    imported++;

    if (batch.length >= 400) {
      await prisma.cutoff.createMany({ data: batch });
      batch.length = 0;
    }
  }

  if (batch.length) await prisma.cutoff.createMany({ data: batch });
  return imported;
}

export type Mah2025Config = {
  validatedAt?: string;
  predictionReady?: boolean;
  pipelineValidatedAt?: string;
  counts?: {
    cutoffsVerified?: number;
    seatMatrices?: number;
    documents?: number;
    cutoffsByRound?: Record<string, number>;
  };
  checks?: Array<{ name: string; ok: boolean; detail?: string }>;
};

export async function readMah2025Config(counsellingId: string): Promise<Mah2025Config> {
  const row = await prisma.counselling.findUnique({ where: { id: counsellingId } });
  try {
    const config = JSON.parse(row?.config ?? "{}") as { maharashtra2025?: Mah2025Config };
    return config.maharashtra2025 ?? {};
  } catch {
    return {};
  }
}

export async function writeMah2025Config(counsellingId: string, patch: Mah2025Config) {
  const row = await prisma.counselling.findUnique({ where: { id: counsellingId } });
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row?.config ?? "{}") as Record<string, unknown>;
  } catch {
    config = {};
  }
  config.maharashtra2025 = { ...(config.maharashtra2025 as object), ...patch };
  await prisma.counselling.update({
    where: { id: counsellingId },
    data: { config: JSON.stringify(config) },
  });
}

export function docTypeForKind(kind: string): DocType {
  switch (kind) {
    case "merit_list":
      return "MERIT_LIST";
    case "registered_list":
      return "REGISTERED_LIST";
    case "seat_matrix":
      return "SEAT_MATRIX";
    case "allotment":
      return "CUTOFF";
    default:
      return "SEAT_MATRIX";
  }
}
