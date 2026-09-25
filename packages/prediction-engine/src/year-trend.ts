export interface YearClosingRank {
  year: number;
  closingRank: number;
  round?: string;
}

export interface YearTrend {
  years: number[];
  byYear: Record<number, number>;
  trend: "TIGHTENING" | "RELAXING" | "STABLE" | "INSUFFICIENT_DATA";
  trendDescription: string;
  projectedRange?: { min: number; max: number };
}

/** Analyse multi-year closing ranks (uses best/latest round per year). */
export function analyseYearTrend(records: YearClosingRank[]): YearTrend {
  const byYear: Record<number, number> = {};

  for (const r of records) {
    const existing = byYear[r.year];
    if (existing === undefined || r.closingRank < existing) {
      byYear[r.year] = r.closingRank;
    }
  }

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length < 2) {
    return {
      years,
      byYear,
      trend: "INSUFFICIENT_DATA",
      trendDescription: "Need 2+ years of data for trend analysis",
    };
  }

  const ranks = years.map((y) => byYear[y]);
  const changes = ranks.slice(1).map((r, i) => r - ranks[i]);
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

  let trend: YearTrend["trend"];
  let trendDescription: string;

  if (Math.abs(avgChange) < 300) {
    trend = "STABLE";
    trendDescription = "Closing ranks relatively stable across recent years";
  } else if (avgChange > 0) {
    trend = "RELAXING";
    trendDescription = "Closing ranks moved higher in recent years (slightly less competitive)";
  } else {
    trend = "TIGHTENING";
    trendDescription = "Closing ranks moved lower in recent years (more competitive)";
  }

  const lastRank = ranks[ranks.length - 1];
  const projectedRange = {
    min: Math.round(lastRank + avgChange * 0.5),
    max: Math.round(lastRank + avgChange * 1.5),
  };

  return { years, byYear, trend, trendDescription, projectedRange };
}
