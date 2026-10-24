export { computeStatistics } from "./statistics";
export { classifyFit } from "./fit-classifier";
export { scoreConfidence } from "./confidence-scorer";
export { analyseYearTrend } from "./year-trend";
export type { YearTrend, YearClosingRank } from "./year-trend";
export {
  aggregateBacktestSlice,
  summarizeBacktestReport,
  trainingFitLevel,
} from "./backtest";
export type {
  BacktestHoldoutSeat,
  BacktestReport,
  BacktestSliceMetrics,
  BacktestTrainingRow,
} from "./backtest";
