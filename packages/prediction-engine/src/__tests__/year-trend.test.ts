import { describe, it, expect } from "vitest";
import { analyseYearTrend } from "../year-trend";

describe("year-trend", () => {
  it("detects relaxing trend when ranks increase", () => {
    const result = analyseYearTrend([
      { year: 2023, closingRank: 15000 },
      { year: 2024, closingRank: 17000 },
      { year: 2025, closingRank: 19000 },
    ]);
    expect(result.trend).toBe("RELAXING");
    expect(result.years).toEqual([2023, 2024, 2025]);
  });

  it("returns insufficient data for single year", () => {
    const result = analyseYearTrend([{ year: 2025, closingRank: 15000 }]);
    expect(result.trend).toBe("INSUFFICIENT_DATA");
  });
});
