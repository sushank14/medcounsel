import { describe, it, expect } from "vitest";
import { classifyFit } from "../fit-classifier";
import { computeStatistics } from "../statistics";

describe("fit-classifier", () => {
  const recentRanks = [18000, 19000, 20000];
  const stats = computeStatistics(recentRanks);

  it("classifies rank better than recent min as STRONG", () => {
    expect(classifyFit(15000, stats, recentRanks)).toBe("STRONG");
  });

  it("classifies rank within recent range as POSSIBLE", () => {
    expect(classifyFit(19500, stats, recentRanks)).toBe("POSSIBLE");
  });

  it("classifies rank slightly above range as BORDERLINE", () => {
    expect(classifyFit(21500, stats, recentRanks)).toBe("BORDERLINE");
  });

  it("classifies rank far above range as DIFFICULT", () => {
    expect(classifyFit(30000, stats, recentRanks)).toBe("DIFFICULT");
  });
});

describe("statistics", () => {
  it("computes median correctly", () => {
    const stats = computeStatistics([18000, 20000, 19000]);
    expect(stats.median).toBe(19000);
    expect(stats.dataYears).toBe(3);
  });
});
