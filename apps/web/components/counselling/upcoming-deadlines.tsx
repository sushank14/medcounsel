import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Deadline = {
  title: string;
  counsellingCode: string;
  eventType: string;
  dateLabel: string;
  phase: string;
  status: string;
  round?: string;
};

export function UpcomingDeadlines({ deadlines }: { deadlines: Deadline[] }) {
  if (!deadlines.length) return null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Upcoming deadlines</h2>
        <Link href="/calendar" className="text-sm text-brand-600 hover:underline">
          Full calendar →
        </Link>
      </div>
      <ul className="space-y-2">
        {deadlines.map((d) => (
          <li
            key={`${d.counsellingCode}-${d.eventType}-${d.dateLabel}`}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs text-slate-500">{d.dateLabel}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {d.phase === "active" && <Badge className="bg-red-100 text-red-800">Today</Badge>}
              <Badge className="bg-slate-100 text-slate-700">{d.counsellingCode}</Badge>
              {d.status === "expected" && (
                <Badge className="bg-amber-50 text-amber-800">Expected</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
