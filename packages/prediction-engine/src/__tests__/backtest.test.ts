import { describe, it, expect } from "vitest";
import { aggregateBacktestSlice, trainingFitLevel } from "../backtest";

describe("backtest", () => {
  it("labels last allotted rank as STRONG/POSSIBLE when history is stable", () => {
    const training = [
      { year: 2021, closingRank: 10000 },
      { year: 2022, closingRank: 10200 },
      { year: 2023, closingRank: 10100 },
    ];
    const fit = trainingFitLevel(training, 2024, 10100);
    expect(["STRONG", "POSSIBLE"]).toContain(fit);
  });

  it("labels rank well above close as DIFFICULT/BORDERLINE", () => {
    const training = [
      { year: 2021, closingRank: 10000 },
      { year: 2022, closingRank: 10200 },
      { year: 2023, closingRank: 10100 },
    ];
    const fit = trainingFitLevel(training, 2024, 14000);
    expect(["DIFFICULT", "BORDERLINE"]).toContain(fit);
  });

  it("aggregates slice metrics", () => {
    const historyByKey = new Map<string, { year: number; closingRank: number }[]>([
      [
        "c1|s1|GENERAL|AIQ",
        [
          { year: 2022, closingRank: 5000 },
          { year: 2023, closingRank: 5200 },
        ],
      ],
    ]);
    const slice = aggregateBacktestSlice({
      testYear: 2024,
      round: "R1",
      category: "GENERAL",
      counsellingCode: "AIQ",
      minHistoryYears: 2,
      seats: [
        {
          year: 2024,
          round: "R1",
          category: "GENERAL",
          closingRank: 5300,
          collegeId: "c1",
          specialtyId: "s1",
          quota: "AIQ",
        },
      ],
      historyByKey,
    });
    expect(slice).not.toBeNull();
    expect(slice!.seatsWithHistory).toBe(1);
    expect(slice!.atClosingRank.pct).toBeGreaterThan(0);
  });
});
