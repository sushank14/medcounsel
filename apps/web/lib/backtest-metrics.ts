import fs from "fs";
import path from "path";
import type { BacktestBundle, BacktestReport, BacktestTrack } from "@medcounsel/prediction-engine";

const REPORT_PATH = path.resolve(process.cwd(), "../../data/reports/backtest-predictions.json");

function isBundle(raw: unknown): raw is BacktestBundle {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "tracks" in raw &&
    Array.isArray((raw as BacktestBundle).tracks)
  );
}

function legacyToTrack(report: BacktestReport): BacktestTrack {
  return {
    counsellingCode: "AIQ",
    rankType: "AIR",
    methodology: report.methodology,
    slices: report.slices.map((s) => ({
      ...s,
      rankType: s.rankType ?? "AIR",
      aboveCloseOffset: s.aboveCloseOffset ?? 3000,
      counsellingCode: "AIQ",
    })),
    overall: report.overall,
  };
}

export function loadBacktestBundle(): BacktestBundle | null {
  try {
    if (!fs.existsSync(REPORT_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as unknown;
    if (isBundle(raw)) return raw;
    return {
      generatedAt: (raw as BacktestReport).generatedAt,
      tracks: [legacyToTrack(raw as BacktestReport)],
    };
  } catch {
    return null;
  }
}

/** @deprecated use loadBacktestBundle */
export function loadBacktestReport(): BacktestReport | null {
  const bundle = loadBacktestBundle();
  if (!bundle?.tracks[0]) return null;
  const t = bundle.tracks[0];
  return {
    generatedAt: bundle.generatedAt,
    methodology: t.methodology,
    slices: t.slices,
    overall: t.overall,
  };
}
