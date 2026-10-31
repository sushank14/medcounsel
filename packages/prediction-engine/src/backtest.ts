import type { FitLevel } from "@medcounsel/types";
import { classifyFit, type RankScale } from "./fit-classifier";
import { computeStatistics } from "./statistics";

export type BacktestTrainingRow = {
  year: number;
  closingRank: number;
};

export type BacktestHoldoutSeat = {
  year: number;
  round: string;
  category: string;
  closingRank: number;
  collegeId: string;
  specialtyId: string;
  quota: string;
};

export type BacktestSliceMetrics = {
  testYear: number;
  round: string;
  category: string;
  counsellingCode: string;
  rankType: RankScale;
  seatsWithHistory: number;
  minHistoryYears: number;
  aboveCloseOffset: number;
  /** Candidate rank = last allotted rank (got the seat). */
  atClosingRank: { strongOrPossible: number; pct: number };
  /** Candidate rank above close by aboveCloseOffset — should not look easy. */
  atClosingRankPlus3000: { difficultOrBorderline: number; pct: number };
  /** |median(prior closes) − actual close| */
  medianAbsError: { mean: number; p50: number; p90: number };
  /** Share where median prior close within ±band of actual. */
  withinMedianBand: { band: number; pct: number };
};

export type BacktestTrack = {
  counsellingCode: "AIQ" | "MAHARASHTRA";
  rankType: RankScale;
  methodology: string;
  dataNote?: string;
  slices: BacktestSliceMetrics[];
  overall: Omit<
    BacktestSliceMetrics,
    "testYear" | "round" | "category" | "counsellingCode" | "rankType" | "aboveCloseOffset"
  > & { label: string };
};

/** @deprecated single-track report — prefer BacktestBundle */
export type BacktestReport = {
  generatedAt: string;
  methodology: string;
  slices: BacktestSliceMetrics[];
  overall: BacktestTrack["overall"];
};

export type BacktestBundle = {
  generatedAt: string;
  tracks: BacktestTrack[];
};

const FIT_STRONG_POSSIBLE: FitLevel[] = ["STRONG", "POSSIBLE"];
const FIT_HARD: FitLevel[] = ["DIFFICULT", "BORDERLINE"];

/** Match production: recent = last 2 counselling years before holdout year. */
export function trainingFitLevel(
  training: BacktestTrainingRow[],
  testYear: number,
  candidateRank: number,
  scale: RankScale = "AIR"
): FitLevel {
  if (!training.length) return "DIFFICULT";

  const closingRanks = training.map((t) => t.closingRank);
  const recentFrom = testYear - 2;
  const recentRanks = training.filter((t) => t.year >= recentFrom).map((t) => t.closingRank);
  const stats = computeStatistics(closingRanks);
  return classifyFit(
    candidateRank,
    stats,
    recentRanks.length ? recentRanks : closingRanks,
    scale
  );
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

export function aggregateBacktestSlice(input: {
  testYear: number;
  round: string;
  category: string;
  counsellingCode: "AIQ" | "MAHARASHTRA";
  rankType: RankScale;
  minHistoryYears: number;
  seats: BacktestHoldoutSeat[];
  historyByKey: Map<string, BacktestTrainingRow[]>;
  aboveCloseOffset?: number;
  medianBand?: number;
}): BacktestSliceMetrics | null {
  const {
    testYear,
    round,
    category,
    counsellingCode,
    rankType,
    minHistoryYears,
    seats,
    historyByKey,
  } = input;

  const aboveCloseOffset =
    input.aboveCloseOffset ?? (rankType === "SML" ? 1200 : 3000);
  const medianBand = input.medianBand ?? (rankType === "SML" ? 650 : 3000);

  let strongOrPossible = 0;
  let difficultOrBorderline = 0;
  const medianErrors: number[] = [];
  let withinBand = 0;
  let evaluated = 0;

  for (const seat of seats) {
    if (seat.year !== testYear || seat.round !== round || seat.category !== category) continue;

    const key = `${seat.collegeId}|${seat.specialtyId}|${seat.category}|${seat.quota}`;
    const training = historyByKey.get(key)?.filter((t) => t.year < testYear) ?? [];
    const distinctYears = new Set(training.map((t) => t.year)).size;
    if (distinctYears < minHistoryYears) continue;

    evaluated++;
    const fitAtClose = trainingFitLevel(training, testYear, seat.closingRank, rankType);
    if (FIT_STRONG_POSSIBLE.includes(fitAtClose)) strongOrPossible++;

    const fitAbove = trainingFitLevel(
      training,
      testYear,
      seat.closingRank + aboveCloseOffset,
      rankType
    );
    if (FIT_HARD.includes(fitAbove)) difficultOrBorderline++;

    const med = computeStatistics(training.map((t) => t.closingRank)).median;
    const err = Math.abs(med - seat.closingRank);
    medianErrors.push(err);
    if (err <= medianBand) withinBand++;
  }

  if (evaluated === 0) return null;

  medianErrors.sort((a, b) => a - b);
  const meanErr = medianErrors.reduce((a, b) => a + b, 0) / medianErrors.length;

  return {
    testYear,
    round,
    category,
    counsellingCode,
    rankType,
    aboveCloseOffset,
    seatsWithHistory: evaluated,
    minHistoryYears,
    atClosingRank: {
      strongOrPossible,
      pct: Math.round((strongOrPossible / evaluated) * 1000) / 10,
    },
    atClosingRankPlus3000: {
      difficultOrBorderline,
      pct: Math.round((difficultOrBorderline / evaluated) * 1000) / 10,
    },
    medianAbsError: {
      mean: Math.round(meanErr),
      p50: Math.round(percentile(medianErrors, 0.5)),
      p90: Math.round(percentile(medianErrors, 0.9)),
    },
    withinMedianBand: {
      band: medianBand,
      pct: Math.round((withinBand / evaluated) * 1000) / 10,
    },
  };
}

/** Maharashtra: train on earlier CAP rounds in the same year, test on later round closes. */
export function aggregateRoundHoldoutSlice(input: {
  year: number;
  testRound: string;
  trainRounds: string[];
  category: string;
  rankType: RankScale;
  seats: BacktestHoldoutSeat[];
  historyByKey: Map<string, (BacktestTrainingRow & { round?: string })[]>;
  aboveCloseOffset?: number;
  medianBand?: number;
}): BacktestSliceMetrics | null {
  const {
    year,
    testRound,
    trainRounds,
    category,
    rankType,
    seats,
    historyByKey,
  } = input;
  const aboveCloseOffset =
    input.aboveCloseOffset ?? (rankType === "SML" ? 1200 : 3000);
  const medianBand = input.medianBand ?? (rankType === "SML" ? 650 : 3000);

  let strongOrPossible = 0;
  let difficultOrBorderline = 0;
  const medianErrors: number[] = [];
  let withinBand = 0;
  let evaluated = 0;

  for (const seat of seats) {
    if (seat.year !== year || seat.round !== testRound || seat.category !== category) continue;

    const key = `${seat.collegeId}|${seat.specialtyId}|${seat.category}|${seat.quota}`;
    const all = historyByKey.get(key) ?? [];
    const training = all.filter(
      (t) => t.year === year && t.round && trainRounds.includes(t.round)
    );
    if (!training.length) continue;

    evaluated++;
    const closingRanks = training.map((t) => t.closingRank);
    const stats = computeStatistics(closingRanks);
    const fitAtClose = classifyFit(seat.closingRank, stats, closingRanks, rankType);
    if (FIT_STRONG_POSSIBLE.includes(fitAtClose)) strongOrPossible++;

    const fitAbove = classifyFit(
      seat.closingRank + aboveCloseOffset,
      stats,
      closingRanks,
      rankType
    );
    if (FIT_HARD.includes(fitAbove)) difficultOrBorderline++;

    const med = stats.median;
    const err = Math.abs(med - seat.closingRank);
    medianErrors.push(err);
    if (err <= medianBand) withinBand++;
  }

  if (evaluated === 0) return null;

  medianErrors.sort((a, b) => a - b);
  const meanErr = medianErrors.reduce((a, b) => a + b, 0) / medianErrors.length;

  return {
    testYear: year,
    round: testRound,
    category,
    counsellingCode: "MAHARASHTRA",
    rankType,
    aboveCloseOffset,
    seatsWithHistory: evaluated,
    minHistoryYears: 1,
    atClosingRank: {
      strongOrPossible,
      pct: Math.round((strongOrPossible / evaluated) * 1000) / 10,
    },
    atClosingRankPlus3000: {
      difficultOrBorderline,
      pct: Math.round((difficultOrBorderline / evaluated) * 1000) / 10,
    },
    medianAbsError: {
      mean: Math.round(meanErr),
      p50: Math.round(percentile(medianErrors, 0.5)),
      p90: Math.round(percentile(medianErrors, 0.9)),
    },
    withinMedianBand: {
      band: medianBand,
      pct: Math.round((withinBand / evaluated) * 1000) / 10,
    },
  };
}

export function summarizeBacktestReport(slices: BacktestSliceMetrics[]): BacktestTrack["overall"] {
  let seats = 0;
  let strongOrPossible = 0;
  let difficultOrBorderline = 0;
  let withinBand = 0;
  let weightedErrorSum = 0;

  for (const s of slices) {
    seats += s.seatsWithHistory;
    strongOrPossible += s.atClosingRank.strongOrPossible;
    difficultOrBorderline += s.atClosingRankPlus3000.difficultOrBorderline;
    withinBand += Math.round((s.withinMedianBand.pct / 100) * s.seatsWithHistory);
    weightedErrorSum += s.medianAbsError.mean * s.seatsWithHistory;
  }

  if (!seats) {
    return {
      label: "No seats evaluated",
      seatsWithHistory: 0,
      minHistoryYears: 0,
      atClosingRank: { strongOrPossible: 0, pct: 0 },
      atClosingRankPlus3000: { difficultOrBorderline: 0, pct: 0 },
      medianAbsError: { mean: 0, p50: 0, p90: 0 },
      withinMedianBand: { band: slices[0]?.withinMedianBand.band ?? 3000, pct: 0 },
    };
  }

  const band = slices[0]?.withinMedianBand.band ?? 3000;
  const sliceP50 = slices.flatMap((s) =>
    Array(Math.max(1, Math.round(s.seatsWithHistory / 10))).fill(s.medianAbsError.p50)
  );
  sliceP50.sort((a, b) => a - b);

  return {
    label: "All evaluated slices (weighted)",
    seatsWithHistory: seats,
    minHistoryYears: slices[0]?.minHistoryYears ?? 2,
    atClosingRank: {
      strongOrPossible,
      pct: Math.round((strongOrPossible / seats) * 1000) / 10,
    },
    atClosingRankPlus3000: {
      difficultOrBorderline,
      pct: Math.round((difficultOrBorderline / seats) * 1000) / 10,
    },
    medianAbsError: {
      mean: Math.round(weightedErrorSum / seats),
      p50: Math.round(percentile(sliceP50, 0.5)),
      p90: Math.round(percentile(sliceP50, 0.9)),
    },
    withinMedianBand: {
      band,
      pct: Math.round((withinBand / seats) * 1000) / 10,
    },
  };
}
