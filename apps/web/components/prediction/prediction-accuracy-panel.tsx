import type { BacktestTrack } from "@medcounsel/prediction-engine";
import { loadBacktestBundle } from "@/lib/backtest-metrics";

function TrackMetrics({ track }: { track: BacktestTrack }) {
  const { overall, slices } = track;
  const offset = slices[0]?.aboveCloseOffset ?? (track.rankType === "SML" ? 1200 : 3000);
  const band = overall.withinMedianBand.band;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">
          {track.counsellingCode === "MAHARASHTRA" ? "Maharashtra CAP" : "MCC AIQ"} ({track.rankType})
        </h3>
        <p className="mt-1 text-xs text-slate-600">{track.methodology}</p>
        {track.dataNote && <p className="mt-1 text-xs text-amber-800">{track.dataNote}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="text-xs text-emerald-800">At official closing rank</p>
          <p className="text-2xl font-bold text-emerald-900">{overall.atClosingRank.pct}%</p>
          <p className="text-xs text-emerald-700">STRONG or POSSIBLE</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-xs text-blue-800">
            Closing + {offset.toLocaleString("en-IN")} {track.rankType}
          </p>
          <p className="text-2xl font-bold text-blue-900">{overall.atClosingRankPlus3000.pct}%</p>
          <p className="text-xs text-blue-700">BORDERLINE or DIFFICULT</p>
        </div>
        <div className="rounded-lg bg-violet-50 p-3">
          <p className="text-xs text-violet-800">Prior median within ±{band} {track.rankType}</p>
          <p className="text-2xl font-bold text-violet-900">{overall.withinMedianBand.pct}%</p>
          <p className="text-xs text-violet-700">of actual closes</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-600">Seats / rows evaluated</p>
          <p className="text-2xl font-bold text-slate-900">
            {overall.seatsWithHistory.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Typical median error: ~{overall.medianAbsError.mean.toLocaleString("en-IN")} {track.rankType} (p50{" "}
        {overall.medianAbsError.p50.toLocaleString("en-IN")}). Not admission probability.
      </p>

      {slices.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Breakdown</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {slices.map((s) => (
              <li key={`${track.counsellingCode}-${s.testYear}-${s.round}-${s.category}`}>
                {s.testYear} {s.round} {s.category}: {s.atClosingRank.pct}% at close ·{" "}
                {s.atClosingRankPlus3000.pct}% at +{s.aboveCloseOffset} · n=
                {s.seatsWithHistory.toLocaleString("en-IN")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PredictionAccuracyPanel() {
  const bundle = loadBacktestBundle();
  if (!bundle?.tracks.length) return null;

  const date = new Date(bundle.generatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">How we measure prediction quality</h2>
      <p className="mt-1 text-xs text-slate-400">
        Backtest updated {date}. My Chances uses the same fit rules; SML uses tighter rank buffers than AIR. Maharashtra
        scores use a strict round hold-out (predict R2/R3 from earlier rounds) — live predictions combine all available
        CAP rounds and usually look more optimistic than this test.
      </p>
      {bundle.tracks.map((track) => (
        <TrackMetrics key={track.counsellingCode} track={track} />
      ))}
    </section>
  );
}
