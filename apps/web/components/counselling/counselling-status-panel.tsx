import Link from "next/link";
import type { TrackStatus } from "@/lib/counselling-guidance";
import { formatEventRange } from "@/lib/counselling-calendar";
import { Badge } from "@/components/ui/badge";

const PHASE_LABELS: Record<TrackStatus["phase"], string> = {
  active: "In progress",
  upcoming: "Upcoming",
  not_started: "Not started",
  past: "Completed",
};

export function CounsellingStatusPanel({ tracks }: { tracks: TrackStatus[] }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">My counselling status</h2>
        <Link href="/counselling" className="text-sm text-brand-600 hover:underline">
          View hub →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {tracks.map((track) => (
          <div key={track.code} className="rounded-lg border bg-slate-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{track.label}</p>
              <Badge
                className={
                  track.phase === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : track.phase === "upcoming"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-700"
                }
              >
                {PHASE_LABELS[track.phase]}
              </Badge>
            </div>
            {track.currentRound && (
              <p className="mt-2 text-sm text-slate-600">Round: {track.currentRound.replace("_", " ")}</p>
            )}
            {track.activeEvent && (
              <p className="mt-1 text-sm text-emerald-800">
                {track.activeEvent.title}
                <span className="block text-xs text-emerald-700/80">
                  {formatEventRange(track.activeEvent.startAt, track.activeEvent.endAt)}
                </span>
              </p>
            )}
            {!track.activeEvent && track.nextEvent && (
              <p className="mt-1 text-sm text-slate-600">
                Next: {track.nextEvent.title}
                <span className="block text-xs text-slate-500">
                  {formatEventRange(track.nextEvent.startAt, track.nextEvent.endAt)}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
