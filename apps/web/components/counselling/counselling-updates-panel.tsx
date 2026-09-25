import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  formatEventRange,
  NEET_PG_2026_NEWS,
  NEET_PG_2026_SESSION,
  upcomingStaticEvents,
  eventPhase,
} from "@/lib/counselling-calendar";

const TAG_STYLES: Record<string, string> = {
  result: "bg-emerald-50 text-emerald-800",
  mcc: "bg-blue-50 text-blue-800",
  maharashtra: "bg-orange-50 text-orange-800",
  cutoff: "bg-purple-50 text-purple-800",
  general: "bg-slate-50 text-slate-700",
};

export function CounsellingUpdatesPanel({ compact = false }: { compact?: boolean }) {
  const upcoming = upcomingStaticEvents(compact ? 4 : 8);
  const news = NEET_PG_2026_NEWS.slice(0, compact ? 2 : 4);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-brand-600">NEET-PG {NEET_PG_2026_SESSION.academicYear}</p>
          <h2 className="text-lg font-semibold">Counselling updates</h2>
          <p className="text-xs text-slate-500">
            Result: {new Date(`${NEET_PG_2026_SESSION.resultDate}T00:00:00+05:30`).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}Updated {NEET_PG_2026_SESSION.lastUpdated}
          </p>
        </div>
        <Link href="/calendar" className="text-sm text-brand-600 hover:underline">
          Full calendar →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Upcoming dates</h3>
          <ul className="space-y-2">
            {upcoming.map((e) => {
              const phase = eventPhase(e.startAt, e.endAt);
              return (
                <li key={`${e.title}-${e.startAt}`} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-slate-500">{formatEventRange(e.startAt, e.endAt)}</span>
                  <span className="min-w-0 flex-1">
                    {e.title.replace(/ \(Expected — verify on official portal\)/, "")}
                    <span className="ml-1.5 inline-flex gap-1">
                      <Badge className="bg-slate-100 text-slate-600">{e.counsellingCode}</Badge>
                      {e.status === "expected" && (
                        <Badge className="bg-amber-50 text-amber-800">Expected</Badge>
                      )}
                      {phase === "active" && (
                        <Badge className="bg-emerald-50 text-emerald-800">Active now</Badge>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Latest news</h3>
          <ul className="space-y-3">
            {news.map((n) => (
              <li key={n.title} className="text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge className={TAG_STYLES[n.tag] ?? TAG_STYLES.general}>{n.tag}</Badge>
                  <span className="text-xs text-slate-400">
                    {new Date(`${n.date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="font-medium text-slate-800">{n.title}</p>
                <p className="text-slate-600">{n.summary}</p>
                {n.url && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                  >
                    Official source ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-3 text-xs">
          <a
            href={NEET_PG_2026_SESSION.mccPortal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            MCC counselling portal ↗
          </a>
          <a
            href={NEET_PG_2026_SESSION.maharashtraPgPortal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            Maharashtra PG CAP ↗
          </a>
        </div>
      )}
    </div>
  );
}
