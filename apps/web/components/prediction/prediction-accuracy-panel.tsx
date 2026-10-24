import type { BacktestReport } from "@medcounsel/prediction-engine";

export function PredictionAccuracyPanel({ report }: { report: BacktestReport }) {
  const { overall, slices, generatedAt } = report;
  const date = new Date(generatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">How we measure prediction quality</h2>
      <p className="mt-2 text-sm text-slate-600">{report.methodology}</p>
      <p className="mt-1 text-xs text-slate-400">Backtest run: {date} · MCC AIQ Round 1 · verified finals only</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="text-xs text-emerald-800">At official closing rank</p>
          <p className="text-2xl font-bold text-emerald-900">{overall.atClosingRank.pct}%</p>
          <p className="text-xs text-emerald-700">labeled STRONG or POSSIBLE</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-xs text-blue-800">Closing rank + 3,000 AIR</p>
          <p className="text-2xl font-bold text-blue-900">{overall.atClosingRankPlus3000.pct}%</p>
          <p className="text-xs text-blue-700">labeled BORDERLINE or DIFFICULT</p>
        </div>
        <div className="rounded-lg bg-violet-50 p-3">
          <p className="text-xs text-violet-800">Prior median within ±{overall.withinMedianBand.band} AIR</p>
          <p className="text-2xl font-bold text-violet-900">{overall.withinMedianBand.pct}%</p>
          <p className="text-xs text-violet-700">of actual closing ranks</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-600">Seats evaluated</p>
          <p className="text-2xl font-bold text-slate-900">
            {overall.seatsWithHistory.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-500">≥{overall.minHistoryYears} prior years each</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Typical median error vs prior years: ~{overall.medianAbsError.mean.toLocaleString("en-IN")} AIR
        (p50 {overall.medianAbsError.p50.toLocaleString("en-IN")}). This is not admission probability —
        cutoffs shift with seats, upgrades, and policy.
      </p>

      {slices.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Breakdown by year & category</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {slices.map((s) => (
              <li key={`${s.testYear}-${s.category}`}>
                {s.testYear} {s.category}: {s.atClosingRank.pct}% at close · {s.atClosingRankPlus3000.pct}%
                at +3k · n={s.seatsWithHistory.toLocaleString("en-IN")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
