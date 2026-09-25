import type { FitLevel, RankStatistics } from "@medcounsel/types";

export function classifyFit(
  candidateRank: number,
  stats: RankStatistics,
  recentRanks: number[]
): FitLevel {
  if (recentRanks.length === 0) return "DIFFICULT";

  const buffer = stats.stddev > 0 ? stats.stddev : 500;
  const recentMin = Math.min(...recentRanks);
  const recentMax = Math.max(...recentRanks);

  if (candidateRank <= recentMin - buffer) return "STRONG";
  if (candidateRank <= recentMax + buffer) return "POSSIBLE";
  if (candidateRank <= recentMax + buffer * 2) return "BORDERLINE";
  return "DIFFICULT";
}
