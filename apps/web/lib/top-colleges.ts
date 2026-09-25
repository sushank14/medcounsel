import { prisma } from "@medcounsel/database";
import type { CuratedCollegeEntry, CuratedGuide } from "@medcounsel/types";
import { getCuratedGuide } from "@medcounsel/types";

export interface ResolvedCuratedEntry extends CuratedCollegeEntry {
  college: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    city: string;
    state: string;
    collegeType: string;
    dataStatus: string;
  } | null;
  medianCutoff?: number;
  cutoffYears?: number;
}

export interface ResolvedGuide extends CuratedGuide {
  resolvedEntries: ResolvedCuratedEntry[];
}

async function resolveCollege(entry: CuratedCollegeEntry) {
  if (entry.collegeSlug) {
    const bySlug = await prisma.college.findUnique({
      where: { slug: entry.collegeSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        city: true,
        state: true,
        collegeType: true,
        dataStatus: true,
      },
    });
    if (bySlug) return bySlug;
  }

  const candidates = await prisma.college.findMany({
    where: {
      AND: entry.nameKeywords.map((kw) => ({
        name: { contains: kw },
      })),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      city: true,
      state: true,
      collegeType: true,
      dataStatus: true,
    },
    take: 10,
  });

  if (!candidates.length) return null;

  return (
    candidates.find((c) => c.dataStatus === "OFFICIAL") ??
    candidates.find((c) => c.collegeType === "GOVT") ??
    candidates[0]
  );
}

async function fetchMedianCutoff(collegeId: string, specialtySlug?: string) {
  if (!specialtySlug) return undefined;

  const specialty = await prisma.specialty.findFirst({
    where: { slug: specialtySlug },
    select: { id: true },
  });
  if (!specialty) return undefined;

  const cutoffs = await prisma.cutoff.findMany({
    where: {
      collegeId,
      specialtyId: specialty.id,
      category: "GENERAL",
      year: { gte: 2023 },
    },
    select: { closingRank: true, year: true },
    orderBy: { year: "desc" },
    take: 20,
  });

  if (!cutoffs.length) return undefined;

  const ranks = cutoffs.map((c) => c.closingRank).sort((a, b) => a - b);
  const mid = Math.floor(ranks.length / 2);
  const median =
    ranks.length % 2 === 0 ? Math.round((ranks[mid - 1] + ranks[mid]) / 2) : ranks[mid];

  return {
    medianCutoff: median,
    cutoffYears: new Set(cutoffs.map((c) => c.year)).size,
  };
}

export async function loadResolvedGuide(slug: string): Promise<ResolvedGuide | null> {
  const guide = getCuratedGuide(slug);
  if (!guide) return null;

  const resolvedEntries: ResolvedCuratedEntry[] = [];

  for (const entry of guide.entries) {
    const college = await resolveCollege(entry);
    let medianCutoff: number | undefined;
    let cutoffYears: number | undefined;

    if (college) {
      const specialtySlug = entry.specialtySlug ?? guide.specialtySlug;
      const cutoff = await fetchMedianCutoff(college.id, specialtySlug);
      medianCutoff = cutoff?.medianCutoff;
      cutoffYears = cutoff?.cutoffYears;
    }

    resolvedEntries.push({
      ...entry,
      college,
      medianCutoff,
      cutoffYears,
    });
  }

  return { ...guide, resolvedEntries };
}

export function competitiveLabel(median?: number, rankType: "AIR" | "SML" = "AIR"): string | null {
  if (!median) return null;
  if (rankType === "SML") {
    if (median <= 500) return "Very competitive (top tier SML)";
    if (median <= 2000) return "Competitive";
    if (median <= 5000) return "Moderate";
    return "Relatively accessible";
  }
  if (median <= 3000) return "Very competitive (top tier AIR)";
  if (median <= 8000) return "Competitive";
  if (median <= 15000) return "Moderate";
  return "Relatively accessible";
}
