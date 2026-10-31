export { computeStatistics } from "./statistics";
export { classifyFit, fitBuffer } from "./fit-classifier";
export type { RankScale } from "./fit-classifier";
export { scoreConfidence } from "./confidence-scorer";
export { analyseYearTrend } from "./year-trend";
export type { YearTrend, YearClosingRank } from "./year-trend";
export {
  aggregateBacktestSlice,
  aggregateRoundHoldoutSlice,
  summarizeBacktestReport,
  trainingFitLevel,
} from "./backtest";
export type {
  BacktestBundle,
  BacktestHoldoutSeat,
  BacktestReport,
  BacktestSliceMetrics,
  BacktestTrack,
  BacktestTrainingRow,
} from "./backtest";
