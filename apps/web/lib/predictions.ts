import { prisma } from "@medcounsel/database";
import {
  computeStatistics,
  classifyFit,
  scoreConfidence,
  analyseYearTrend,
} from "@medcounsel/prediction-engine";
import type { PredictionInput, PredictionResult } from "@medcounsel/types";
import {
  DISCLAIMER,
  displayCollegeName,
  excludeDemoCollegesWhere,
  isDemoCollege,
  qualifiesAsGovernmentCollege,
  resolveCollegeCity,
  matchesAnyPreferredCity,
  matchesPreferredCity,
} from "@medcounsel/types";

const MCC_SOURCE_URL = "https://mcc.nic.in/pg-medical-counselling/";

const BUDGET_LIMITS: Record<string, number> = {
  UNDER_5L: 500000,
  RANGE_5_10L: 1000000,
  RANGE_10_20L: 2000000,
  RANGE_20_50L: 5000000,
  ABOVE_50L: Infinity,
  NO_RESTRICTION: Infinity,
};

const COLLEGE_PREF_MAP: Record<string, string[]> = {
  GOVT_ONLY: ["GOVT", "CENTRAL"],
  GOVT_PRIVATE: ["GOVT", "CENTRAL", "PRIVATE", "STATE_UNIV"],
  DEEMED: ["DEEMED"],
  CENTRAL: ["CENTRAL"],
  STATE_UNIV: ["STATE_UNIV"],
  PRIVATE: ["PRIVATE", "DEEMED"],
  ANY: ["GOVT", "CENTRAL", "PRIVATE", "DEEMED", "STATE_UNIV"],
};

/** Applicable quotas per counselling preference */
function applicableQuotas(counsellingPref: PredictionInput["counsellingPref"], counsellingCode: string) {
  if (counsellingCode === "MAHARASHTRA") return new Set(["STATE", "AIQ"]);
  if (counsellingPref === "AIQ") return new Set(["AIQ", "IQ"]);
  if (counsellingPref === "STATE") return new Set(["STATE"]);
  return new Set(["AIQ", "STATE", "IQ", "MANAGEMENT", "NRI"]);
}

function priorityScore(
  result: PredictionResult,
  priorities: string[],
  input: PredictionInput
): number {
  let score = 0;
  priorities.forEach((priority, index) => {
    const weight = priorities.length - index;
    switch (priority) {
      case "Branch":
        if (
          input.preferredSpecialties?.some(
            (p) =>
              result.specialtyName.toLowerCase().includes(p.toLowerCase()) ||
              p.toLowerCase().includes(result.specialtyName.toLowerCase())
          )
        ) {
          score += weight * 20;
        }
        break;
      case "College":
        if (result.dataStatus === "OFFICIAL") score += weight * 5;
        break;
      case "Location":
        if (result.state === input.domicileState) score += weight * 15;
        if (input.stateFilter && result.state === input.stateFilter) score += weight * 10;
        if (matchesAnyPreferredCity(result.city, input.preferredCities)) score += weight * 20;
        break;
      case "Fees":
        if (result.fees) score += weight * Math.max(0, 2_000_000 - result.fees.totalAnnual) / 100_000;
        else score += weight * 2;
        break;
      case "Government college":
        if (result.collegeType === "GOVT" || result.collegeType === "CENTRAL") score += weight * 15;
        break;
      case "Stipend":
        if (result.stipend) score += weight * (result.stipend.totalMonthly / 5000);
        break;
      case "Bond":
        if (!result.bond?.bondAmount) score += weight * 10;
        break;
      default:
        break;
    }
  });
  return score;
}

function rankWindow(rank: number, rankType: "AIR" | "SML") {
  if (rankType === "SML") {
    return { min: Math.max(1, rank - 3000), max: rank + 8000 };
  }
  return { min: Math.max(1, Math.floor(rank * 0.4)), max: rank * 2.5 + 15000 };
}

function passesBudgetFilter(
  budgetRange: string | undefined,
  fee: { totalAnnual: number } | undefined
): boolean {
  if (!budgetRange || budgetRange === "NO_RESTRICTION") return true;
  if (!fee) return true; // unknown fee — don't exclude official colleges
  const limit = BUDGET_LIMITS[budgetRange] ?? Infinity;
  return fee.totalAnnual <= limit;
}

export async function generatePredictions(
  input: PredictionInput,
  options?: { limit?: number }
): Promise<PredictionResult[]> {
  const counsellingCodes =
    input.counsellingPref === "AIQ"
      ? ["AIQ"]
      : input.counsellingPref === "STATE"
      ? ["MAHARASHTRA"]
      : ["AIQ", "MAHARASHTRA"];

  const counsellings = await prisma.counselling.findMany({
    where: { code: { in: counsellingCodes }, isActive: true },
  });

  const counsellingIds = counsellings.map((c) => c.id);

  const useSmlRank = input.rankType === "SML" || input.counsellingPref === "STATE";
  const airWindow = rankWindow(input.rank, useSmlRank ? "SML" : "AIR");
  const smlWindow = rankWindow(input.rank, "SML");

  const rankFilters =
    input.counsellingPref === "STATE" && input.domicileState === "Maharashtra"
      ? [{ rankType: "SML" as const, closingRank: { gte: smlWindow.min, lte: smlWindow.max } }]
      : input.counsellingPref === "AIQ"
      ? [{ rankType: "AIR" as const, closingRank: { gte: airWindow.min, lte: airWindow.max } }]
      : [
          { rankType: "AIR" as const, closingRank: { gte: airWindow.min, lte: airWindow.max } },
          { rankType: "SML" as const, closingRank: { gte: smlWindow.min, lte: smlWindow.max } },
        ];

  const collegeTypes =
    input.collegeTypeFilter?.length
      ? input.collegeTypeFilter
      : COLLEGE_PREF_MAP[input.collegePref ?? "ANY"] ?? COLLEGE_PREF_MAP.ANY;

  const degreeFilter =
    input.degreeFilter && input.degreeFilter !== "ALL" ? input.degreeFilter : undefined;

  const cutoffs = await prisma.cutoff.findMany({
    where: {
      counsellingId: { in: counsellingIds },
      category: input.category as never,
      OR: rankFilters,
      ...(degreeFilter ? { specialty: { degree: degreeFilter as never } } : {}),
      college: {
        collegeType: { in: collegeTypes as never[] },
        ...excludeDemoCollegesWhere,
      },
    },
    include: {
      college: { include: { fees: true, bonds: true, stipends: true, specialties: true } },
      specialty: true,
      counselling: true,
      round: true,
      source: true,
    },
    orderBy: [{ year: "desc" }, { closingRank: "asc" }],
    take: 8000,
  });

  const grouped = new Map<string, typeof cutoffs>();
  for (const c of cutoffs) {
    const key = `${c.collegeId}-${c.specialtyId}-${c.counsellingId}-${c.category}-${c.quota}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  const results: PredictionResult[] = [];
  const allowedQuotas = applicableQuotas(input.counsellingPref, "");

  for (const [, group] of grouped) {
    const sample = group[0];
    const college = sample.college;
    const specialty = sample.specialty;
    const counselling = sample.counselling;

    if (isDemoCollege(college.slug, college.dataStatus)) continue;

    if (
      input.collegePref === "GOVT_ONLY" &&
      !qualifiesAsGovernmentCollege(college.name, college.collegeType, specialty.name, specialty.degree)
    ) {
      continue;
    }

    const quotasForRow = applicableQuotas(input.counsellingPref, counselling.code);
    if (!quotasForRow.has(sample.quota)) continue;

    if (input.stateFilter && college.state !== input.stateFilter) continue;
    if (input.cityFilter && !matchesPreferredCity(college.city, input.cityFilter)) continue;
    if (counselling.code === "MAHARASHTRA" && input.domicileState !== "Maharashtra") continue;

    if (input.preferredSpecialties?.length) {
      const specLabel = `${specialty.degree} ${specialty.name}`;
      const matches = input.preferredSpecialties.some(
        (p) =>
          p.toLowerCase().includes(specialty.name.toLowerCase()) ||
          specLabel.toLowerCase().includes(p.toLowerCase())
      );
      if (!matches) continue;
    }

    const fee = college.fees.find((f) => f.verifiedAt) ?? college.fees[0];
    if (!passesBudgetFilter(input.budgetRange, fee)) continue;

    const closingRanks = group.map((g) => g.closingRank);
    const recentRanks = group.filter((g) => g.year >= 2024).map((g) => g.closingRank);
    const stats = computeStatistics(closingRanks);

    const effectiveRankType =
      counselling.rankType === "SML" && input.domicileState === "Maharashtra" ? "SML" : "AIR";

    const fitLevel = classifyFit(input.rank, stats, recentRanks.length ? recentRanks : closingRanks);
    const dataYears = new Set(group.map((g) => g.year)).size;
    const dataRounds = new Set(group.map((g) => `${g.year}-${g.round?.round ?? "R1"}`)).size;
    const { level: confidence, reason: confidenceReason } = scoreConfidence(
      dataYears,
      stats.stddev,
      stats.median,
      false,
      group.some((g) => g.verificationStatus === "VERIFIED"),
      dataRounds
    );

    const yearWiseMap = new Map<number, { closingRank: number; round: string }>();
    for (const g of group) {
      const round = g.round?.round ?? "R1";
      const existing = yearWiseMap.get(g.year);
      if (!existing || g.closingRank >= existing.closingRank) {
        yearWiseMap.set(g.year, { closingRank: g.closingRank, round });
      }
    }

    const yearWiseCutoffs = [...yearWiseMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, v]) => ({ year, closingRank: v.closingRank, round: v.round }));

    const yearTrend = analyseYearTrend(
      yearWiseCutoffs.map((y) => ({ year: y.year, closingRank: y.closingRank, round: y.round }))
    );

    const stipend =
      college.stipends.find((s) => s.yearOfTraining === "Y1" && s.verificationStatus === "VERIFIED") ??
      college.stipends.find((s) => s.yearOfTraining === "Y1");
    const bond = college.bonds.find((b) => b.verifiedAt) ?? college.bonds[0];

    const roundMovement = group
      .filter((g) => g.year === Math.max(...group.map((x) => x.year)))
      .sort((a, b) => {
        const order = { R1: 1, R2: 2, R3: 3, STRAY: 4, SPECIAL: 5 };
        return (order[a.round?.round as keyof typeof order] ?? 9) - (order[b.round?.round as keyof typeof order] ?? 9);
      })
      .map((g) => ({
        round: g.round?.round ?? "R1",
        closingRank: g.closingRank,
        year: g.year,
      }));

    const seatRecord = college.specialties.find((cs) => cs.specialtyId === specialty.id);
    const seatCount = seatRecord?.totalSeats ?? 0;

    const latestSource = group.find((g) => g.source?.url)?.source;

    results.push({
      collegeId: college.id,
      collegeName: displayCollegeName(college.name),
      collegeSlug: college.slug,
      collegeType: college.collegeType,
      state: college.state,
      city: resolveCollegeCity(college.name, college.slug, college.state) ?? college.city ?? college.state,
      specialtyId: specialty.id,
      specialtyName: specialty.name,
      degree: specialty.degree,
      counsellingCode: counselling.code,
      counsellingName: counselling.name,
      category: sample.category,
      quota: sample.quota,
      candidateRank: input.rank,
      rankType: effectiveRankType as PredictionResult["rankType"],
      historicalCutoffs: group.map((g) => ({
        year: g.year,
        round: g.round?.round ?? "R1",
        closingRank: g.closingRank,
        openingRank: g.openingRank,
        category: g.category,
        quota: g.quota,
      })),
      yearWiseCutoffs,
      yearTrend,
      statistics: { ...stats, dataYears: yearWiseCutoffs.length },
      candidateDiff: input.rank - stats.median,
      fitLevel,
      confidence,
      confidenceReason: `${confidenceReason}. Category: ${sample.category}, Quota: ${sample.quota}. Years: ${yearWiseCutoffs.map((y) => y.year).join(", ")} (${dataRounds} round records).`,
      fees: fee
        ? {
            totalAnnual: fee.totalAnnual,
            tuitionFee: fee.tuitionFee,
            hostelFee: fee.hostelFee,
            isEstimate: !fee.verifiedAt,
          }
        : undefined,
      bond: bond
        ? {
            durationYears: bond.durationYears,
            bondAmount: bond.bondAmount,
            serviceObligation: bond.serviceObligation,
          }
        : undefined,
      stipend: stipend
        ? {
            totalMonthly: stipend.totalMonthly,
            yearOfTraining: stipend.yearOfTraining,
            payScale: stipend.payScale,
          }
        : undefined,
      roundMovement,
      seatCount,
      sourceUrl: latestSource?.url ?? MCC_SOURCE_URL,
      sourceTitle: latestSource?.title ?? "MCC PG Medical Counselling",
      dataStatus: college.dataStatus,
      disclaimer: DISCLAIMER,
    });
  }

  const fitOrder = { STRONG: 0, POSSIBLE: 1, BORDERLINE: 2, DIFFICULT: 3 };
  const priorities = input.priorityRanking ?? [];
  const sorted = results.sort((a, b) => {
    const fitDiff = fitOrder[a.fitLevel] - fitOrder[b.fitLevel];
    if (fitDiff !== 0) return fitDiff;
    if (priorities.length) {
      const priDiff = priorityScore(b, priorities, input) - priorityScore(a, priorities, input);
      if (priDiff !== 0) return priDiff;
    }
    return Math.abs(a.candidateDiff) - Math.abs(b.candidateDiff);
  });

  const limit = options?.limit ?? 300;
  return sorted.slice(0, limit);
}

export async function compareCategoriesForOption(
  collegeId: string,
  specialtyId: string,
  counsellingId: string,
  candidateRank: number
) {
  const cutoffs = await prisma.cutoff.findMany({
    where: { collegeId, specialtyId, counsellingId },
    include: { round: true },
    orderBy: [{ category: "asc" }, { year: "desc" }],
  });

  const byCategory = new Map<string, typeof cutoffs>();
  for (const c of cutoffs) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  return [...byCategory.entries()].map(([category, group]) => {
    const recent = group.filter((g) => g.year >= 2024).map((g) => g.closingRank);
    const stats = computeStatistics(group.map((g) => g.closingRank));
    const fitLevel = classifyFit(candidateRank, stats, recent.length ? recent : group.map((g) => g.closingRank));
    return {
      category,
      quota: group[0].quota,
      medianClosing: stats.median,
      fitLevel,
      years: [...new Set(group.map((g) => g.year))].sort(),
    };
  });
}
