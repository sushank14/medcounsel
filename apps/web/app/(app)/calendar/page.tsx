import Link from "next/link";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { CounsellingUpdatesPanel } from "@/components/counselling/counselling-updates-panel";
import {
  eventsByCounselling,
  eventPhase,
  formatEventRange,
  NEET_PG_2026_SESSION,
} from "@/lib/counselling-calendar";

function EventList({ code }: { code: "AIQ" | "MAHARASHTRA" }) {
  const events = eventsByCounselling(code);
  const portal =
    code === "AIQ" ? NEET_PG_2026_SESSION.mccPortal : NEET_PG_2026_SESSION.maharashtraPgPortal;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{code === "AIQ" ? "MCC AIQ (50% seats)" : "Maharashtra CAP (state quota)"}</h2>
        <a href={portal} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
          Official portal ↗
        </a>
      </div>
      {events.map((e) => {
        const phase = eventPhase(e.startAt, e.endAt);
        return (
          <div
            key={`${e.title}-${e.startAt}`}
            className="card flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge className="bg-slate-100 text-slate-600">{e.eventType.replace("_", " ")}</Badge>
                {e.round && <Badge className="bg-brand-50 text-brand-800">{e.round}</Badge>}
                {e.status === "official" && (
                  <Badge className="bg-emerald-50 text-emerald-800">MCC official (tentative)</Badge>
                )}
                {e.status === "expected" && (
                  <Badge className="bg-amber-50 text-amber-800">Expected — verify officially</Badge>
                )}
                {phase === "active" && <Badge className="bg-emerald-50 text-emerald-800">Active now</Badge>}
                {phase === "past" && <Badge className="bg-slate-50 text-slate-500">Completed</Badge>}
              </div>
            </div>
            <p className="text-sm text-slate-600">{formatEventRange(e.startAt, e.endAt)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default async function CalendarPage() {
  const dbEvents = await prisma.calendarEvent.findMany({
    include: { counselling: true, source: true },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Counselling Calendar</h1>
        <p className="text-slate-600">
          NEET-PG {NEET_PG_2026_SESSION.academicYear} — MCC AIQ & Maharashtra CAP dates
        </p>
      </div>

      <CounsellingUpdatesPanel />

      <DisclaimerBanner compact />

      <EventList code="AIQ" />
      <EventList code="MAHARASHTRA" />

      {dbEvents.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer font-medium text-slate-700">
            Synced database events ({dbEvents.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {dbEvents.map((e) => (
              <li key={e.id}>
                {e.title} · {e.counselling.name} ·{" "}
                {e.startAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-slate-400">
        Official schedules:{" "}
        <a href={NEET_PG_2026_SESSION.mccSchedulePdf} className="text-brand-600 hover:underline" target="_blank" rel="noopener">
          MCC 2026 allotment PDF (DGHS)
        </a>
        {" · "}
        <a href={NEET_PG_2026_SESSION.mccSchedule} className="text-brand-600 hover:underline" target="_blank" rel="noopener">
          mcc.nic.in schedule
        </a>
        {" · "}
        <Link href="/cutoffs" className="text-brand-600 hover:underline">
          Browse historical cutoffs
        </Link>
      </p>
    </div>
  );
}
