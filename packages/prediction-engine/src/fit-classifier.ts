import type { FitLevel, RankStatistics } from "@medcounsel/types";

export type RankScale = "AIR" | "SML";

/** Buffer for fit bands — SML ranks are on a much smaller scale than AIR. */
export function fitBuffer(stddev: number, scale: RankScale = "AIR"): number {
  if (scale === "SML") {
    if (stddev > 0) return Math.max(200, Math.round(stddev * 0.55));
    return 220;
  }
  if (stddev > 0) return Math.max(500, stddev);
  return 500;
}

export function classifyFit(
  candidateRank: number,
  stats: RankStatistics,
  recentRanks: number[],
  scale: RankScale = "AIR"
): FitLevel {
  if (recentRanks.length === 0) return "DIFFICULT";

  const buffer = fitBuffer(stats.stddev, scale);
  const recentMin = Math.min(...recentRanks);
  const recentMax = Math.max(...recentRanks);

  if (candidateRank <= recentMin - buffer) return "STRONG";
  if (candidateRank <= recentMax + buffer) return "POSSIBLE";
  if (candidateRank <= recentMax + buffer * 2) return "BORDERLINE";
  return "DIFFICULT";
}
