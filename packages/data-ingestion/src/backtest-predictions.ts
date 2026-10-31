/**
 * Hold-out backtest for AIQ (year hold-out) and Maharashtra SML (round hold-out within 2025).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import {
  aggregateBacktestSlice,
  aggregateRoundHoldoutSlice,
  summarizeBacktestReport,
  type BacktestBundle,
  type BacktestHoldoutSeat,
  type BacktestTrainingRow,
} from "@medcounsel/prediction-engine";

const defaultDb = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../database/prisma/prod.db"
);
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${defaultDb}`;
}

const prisma = new PrismaClient();
const REPORT_DIR = path.resolve(process.cwd(), "../../data/reports");
const REPORT_FILE = path.join(REPORT_DIR, "backtest-predictions.json");

type TrainingRow = BacktestTrainingRow & { round?: string };

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

async function buildAiqTrack(testYears: number[], minHistoryYears: number) {
  const rounds = ["R1"] as const;
  const categories = ["GENERAL", "OBC", "EWS"] as const;

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

  const slices = [];
  for (const testYear of testYears) {
    for (const round of rounds) {
      for (const category of categories) {
        const slice = aggregateBacktestSlice({
          testYear,
          round,
          category,
          counsellingCode: "AIQ",
          rankType: "AIR",
          minHistoryYears,
          seats: allSeats,
          historyByKey,
        });
        if (slice) slices.push(slice);
      }
    }
  }

  return {
    counsellingCode: "AIQ" as const,
    rankType: "AIR" as const,
    methodology:
      "Year hold-out on verified MCC AIQ Round 1 finals. Training = prior years only (same college, course, category, quota). Fit uses AIR-scale buffers. At closing rank → success if STRONG/POSSIBLE. At closing + 3,000 AIR → success if BORDERLINE/DIFFICULT.",
    slices,
    overall: summarizeBacktestReport(slices),
  };
}

async function buildMaharashtraTrack() {
  const categories = ["GENERAL", "OBC", "EWS", "SC", "ST"] as const;
  const year = 2025;

  const cutoffs = await prisma.cutoff.findMany({
    where: {
      counselling: { code: "MAHARASHTRA" },
      rankType: "SML",
      year,
      category: { in: [...categories] },
    },
    include: { round: { select: { round: true } } },
  });

  const historyByKey = new Map<string, TrainingRow[]>();
  const allSeats: BacktestHoldoutSeat[] = [];

  for (const c of cutoffs) {
    const round = c.round?.round ?? "R1";
    const key = `${c.collegeId}|${c.specialtyId}|${c.category}|${c.quota}`;
    if (!historyByKey.has(key)) historyByKey.set(key, []);
    historyByKey.get(key)!.push({ year: c.year, closingRank: c.closingRank, round });

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

  const slices = [];
  const roundTests: { testRound: string; trainRounds: string[] }[] = [
    { testRound: "R2", trainRounds: ["R1"] },
    { testRound: "R3", trainRounds: ["R1", "R2"] },
  ];

  for (const { testRound, trainRounds } of roundTests) {
    for (const category of categories) {
      const slice = aggregateRoundHoldoutSlice({
        year,
        testRound,
        trainRounds,
        category,
        rankType: "SML",
        seats: allSeats,
        historyByKey,
      });
      if (slice) slices.push(slice);
    }
  }

  return {
    counsellingCode: "MAHARASHTRA" as const,
    rankType: "SML" as const,
    methodology:
      "Round hold-out on Maharashtra CAP 2025 selection lists (SML). Train on earlier rounds in the same year; test whether later-round closing ranks fit prior-round statistics. Uses SML-scale buffers (tighter than AIR). At closing + 1,200 SML → expect BORDERLINE/DIFFICULT.",
    dataNote:
      "Only 2025 CAP data in database today. Import 2024+ selection lists when available for year hold-out SML backtests.",
    slices,
    overall: summarizeBacktestReport(slices),
  };
}

async function main() {
  const testYears = parseYearsArg();
  const minHistoryYears = parseMinHistory();

  console.log("📊 Backtesting fit labels (AIQ AIR + Maharashtra SML)\n");

  const aiq = await buildAiqTrack(testYears, minHistoryYears);
  const mh = await buildMaharashtraTrack();

  const bundle: BacktestBundle = {
    generatedAt: new Date().toISOString(),
    tracks: [aiq, mh],
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(bundle, null, 2));

  for (const track of bundle.tracks) {
    const o = track.overall;
    const offset = track.slices[0]?.aboveCloseOffset ?? (track.rankType === "SML" ? 1200 : 3000);
    const band = track.slices[0]?.withinMedianBand.band ?? 3000;
    console.log(`\n=== ${track.counsellingCode} (${track.rankType}) ===`);
    if (track.dataNote) console.log(`   ${track.dataNote}`);
    console.log(`   Seats evaluated: ${o.seatsWithHistory.toLocaleString("en-IN")}`);
    console.log(`   At closing rank → STRONG/POSSIBLE: ${o.atClosingRank.pct}%`);
    console.log(`   At closing + ${offset} ${track.rankType} → hard labels: ${o.atClosingRankPlus3000.pct}%`);
    console.log(`   Prior median within ±${band} ${track.rankType}: ${o.withinMedianBand.pct}%`);
    console.log(`   Mean |median error|: ${o.medianAbsError.mean.toLocaleString("en-IN")} ${track.rankType}`);
  }

  console.log(`\n✅ Report → ${REPORT_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
