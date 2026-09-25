import type { RankStatistics } from "@medcounsel/types";

export function computeStatistics(ranks: number[]): RankStatistics {
  if (ranks.length === 0) {
    return { median: 0, mean: 0, min: 0, max: 0, stddev: 0, dataYears: 0 };
  }

  const sorted = [...ranks].sort((a, b) => a - b);
  const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  const variance =
    ranks.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ranks.length;

  return {
    median: Math.round(median),
    mean: Math.round(mean),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stddev: Math.round(Math.sqrt(variance)),
    dataYears: ranks.length,
  };
}
