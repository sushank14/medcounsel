import type { ConfidenceLevel } from "@medcounsel/types";

export function scoreConfidence(
  dataYears: number,
  stddev: number,
  median: number,
  isDemo: boolean,
  isVerified: boolean,
  dataRounds = 0
): { level: ConfidenceLevel; reason: string } {
  if (isDemo) {
    return { level: "LOW", reason: "Demo/sample data — not verified official cutoffs" };
  }

  if (dataYears >= 4 && isVerified && dataRounds >= 4) {
    const varianceRatio = median > 0 ? stddev / median : 1;
    if (varianceRatio < 0.2) {
      return {
        level: "HIGH",
        reason: `${dataYears} years of verified MCC data across ${dataRounds} counselling rounds`,
      };
    }
    return {
      level: "MEDIUM",
      reason: `${dataYears} years verified with moderate year-over-year variation`,
    };
  }

  if (dataYears >= 3 && isVerified) {
    return {
      level: "MEDIUM",
      reason: `${dataYears} years of verified official MCC cutoffs on record`,
    };
  }

  if (dataYears >= 2) {
    return {
      level: "MEDIUM",
      reason: `${dataYears} years of official MCC data — limited history for this seat`,
    };
  }

  return { level: "LOW", reason: "Only one year of historical cutoff data available" };
}
