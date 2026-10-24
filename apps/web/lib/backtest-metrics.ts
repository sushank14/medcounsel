import fs from "fs";
import path from "path";
import type { BacktestReport } from "@medcounsel/prediction-engine";

const REPORT_PATH = path.resolve(process.cwd(), "../../data/reports/backtest-predictions.json");

export function loadBacktestReport(): BacktestReport | null {
  try {
    if (!fs.existsSync(REPORT_PATH)) return null;
    return JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as BacktestReport;
  } catch {
    return null;
  }
}
