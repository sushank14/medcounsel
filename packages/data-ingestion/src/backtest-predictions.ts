/**
 * Hold-out backtest: predict fit using only years before each test year, compare to official closes.
 *
 * Usage: npx tsx src/backtest-predictions.ts [--years=2023,2024,2025] [--min-history=2]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const defaultDb = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../database/prisma/prod.db"
);
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${defaultDb}`;
}
import {
  aggregateBacktestSlice,
  summarizeBacktestReport,
  type BacktestHoldoutSeat,
  type BacktestReport,
  type BacktestTrainingRow,
} from "@medcounsel/prediction-engine";

const prisma = new PrismaClient();
const REPORT_DIR = path.resolve(process.cwd(), "../../data/reports");
const REPORT_FILE = path.join(REPORT_DIR, "backtest-predictions.json");

function parseYearsArg(): number[] {
  const eq = process.argv.find((a) => a.startsWith("--years="));
  if (eq) return eq.split("=")[1].split(",").map(Number);
  return [2023, 2024, 2025];
}

function parseMinHistory(): number {
  const eq = process.argv.find((a) => a.startsWith("--min-history="));
  if (eq) return parseInt(eq.split("=")[1], 10);
  return 2;
}

async function main() {
  const testYears = parseYearsArg();
  const minHistoryYears = parseMinHistory();
  const rounds = ["R1"] as const;
  const categories = ["GENERAL", "OBC", "EWS"] as const;

  console.log("📊 Backtesting prediction fit labels against official MCC AIQ cutoffs");
  console.log(`   Test years: ${testYears.join(", ")} · Round R1 · min ${minHistoryYears} prior years\n`);

  const cutoffs = await prisma.cutoff.findMany({
    where: {
      counselling: { code: "AIQ" },
      verificationStatus: "VERIFIED",
      rankType: "AIR",
      year: { lte: Math.max(...testYears) },
      category: { in: [...categories] },
    },
    include: { round: { select: { round: true } } },
  });

  const historyByKey = new Map<string, BacktestTrainingRow[]>();
  const allSeats: BacktestHoldoutSeat[] = [];

  for (const c of cutoffs) {
    const round = c.round?.round ?? "R1";
    const key = `${c.collegeId}|${c.specialtyId}|${c.category}|${c.quota}`;
    if (!historyByKey.has(key)) historyByKey.set(key, []);
    historyByKey.get(key)!.push({ year: c.year, closingRank: c.closingRank });

    allSeats.push({
      year: c.year,
      round,
      category: c.category,
      closingRank: c.closingRank,
      collegeId: c.collegeId,
      specialtyId: c.specialtyId,
      quota: c.quota,
    });
  }

  const slices: BacktestReport["slices"] = [];

  for (const testYear of testYears) {
    for (const round of rounds) {
      for (const category of categories) {
        const slice = aggregateBacktestSlice({
          testYear,
          round,
          category,
          counsellingCode: "AIQ",
          minHistoryYears,
          seats: allSeats,
          historyByKey,
        });
        if (slice) slices.push(slice);
      }
    }
  }

  const overall = summarizeBacktestReport(slices);

  const report: BacktestReport = {
    generatedAt: new Date().toISOString(),
    methodology:
      "For each official AIQ seat in the test year, training uses only prior years' closing ranks (same college, course, category, quota). Fit labels use the same classifyFit rules as My Chances. At closing rank: success if STRONG or POSSIBLE. At closing+3000 AIR: success if BORDERLINE or DIFFICULT.",
    slices,
    overall,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log("Overall (AIQ R1, GENERAL+OBC+EWS):");
  console.log(
    `  Seats with ≥${minHistoryYears} prior years: ${overall.seatsWithHistory.toLocaleString("en-IN")}`
  );
  console.log(
    `  At actual closing rank → STRONG/POSSIBLE: ${overall.atClosingRank.pct}% (${overall.atClosingRank.strongOrPossible.toLocaleString("en-IN")} seats)`
  );
  console.log(
    `  At closing + 3000 AIR → BORDERLINE/DIFFICULT: ${overall.atClosingRankPlus3000.pct}%`
  );
  console.log(
    `  Prior-year median within ±${overall.withinMedianBand.band} AIR of actual close: ${overall.withinMedianBand.pct}%`
  );
  console.log(
    `  Median absolute error (prior median vs actual): mean ${overall.medianAbsError.mean.toLocaleString("en-IN")} AIR`
  );
  console.log("\nBy year / category:");
  for (const s of slices) {
    console.log(
      `  ${s.testYear} ${s.category}: close→S/P ${s.atClosingRank.pct}% · +3k→hard ${s.atClosingRankPlus3000.pct}% · n=${s.seatsWithHistory}`
    );
  }
  console.log(`\n✅ Report → ${REPORT_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
