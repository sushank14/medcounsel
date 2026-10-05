import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  AIQ_COUNSELLING,
  STATE_COUNSELLING_REGISTRY,
  NEET_PG_2026_SESSION,
} from "@medcounsel/types";
import { getTrackStatuses } from "@/lib/counselling-guidance";
import { eventsByCounselling, formatEventRange, eventPhase } from "@/lib/counselling-calendar";
import { CounsellingStatusPanel } from "@/components/counselling/counselling-status-panel";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CounsellingHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tracks = getTrackStatuses();
  const aiqEvents = eventsByCounselling("AIQ");
  const mhEvents = eventsByCounselling("MAHARASHTRA");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-600">NEET-PG {NEET_PG_2026_SESSION.academicYear}</p>
        <h1 className="text-2xl font-bold">Counselling Hub</h1>
        <p className="mt-1 text-slate-600">
          AIQ and state tracks — official links, rounds, and what&apos;s active now.
        </p>
      </div>

      <DisclaimerBanner compact />
      <CounsellingStatusPanel tracks={tracks} />

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{AIQ_COUNSELLING.label}</h2>
            <p className="text-sm text-slate-600">{AIQ_COUNSELLING.authority}</p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-800">Rank: {AIQ_COUNSELLING.rankType}</Badge>
        </div>
        <p className="text-sm text-slate-700">{AIQ_COUNSELLING.eligibility}</p>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">Quotas:</span> {AIQ_COUNSELLING.quotaSummary}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium">Categories:</span> {AIQ_COUNSELLING.categories}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={AIQ_COUNSELLING.portalUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm">MCC portal ↗</Button>
          </a>
          {AIQ_COUNSELLING.scheduleUrl && (
            <a href={AIQ_COUNSELLING.scheduleUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">Official schedule ↗</Button>
            </a>
          )}
          <Link href="/my-chances">
            <Button variant="outline" size="sm">My AIQ options</Button>
          </Link>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Round timeline (expected)</summary>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {aiqEvents.map((e) => (
              <li key={e.title} className="flex flex-wrap gap-2">
                <span>{e.round ?? "—"}</span>
                <span>{e.title}</span>
                <span className="text-slate-400">{formatEventRange(e.startAt, e.endAt)}</span>
                {e.status === "expected" && (
                  <Badge className="bg-amber-50 text-amber-800 text-[10px]">Expected</Badge>
                )}
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-3 text-xs text-slate-500">
          Upgrade: {AIQ_COUNSELLING.upgradeNote} Exit/resign: {AIQ_COUNSELLING.exitNote}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">State counselling</h2>
        <p className="mb-4 text-sm text-slate-600">
          Each state runs its own PG counselling with separate registration, merit list, and rules.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {STATE_COUNSELLING_REGISTRY.map((state) => (
            <div key={state.stateCode} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{state.stateName}</h3>
                {state.supported ? (
                  <Badge className="bg-emerald-50 text-emerald-800">Supported</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600">Coming soon</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">{state.authority}</p>
              <p className="mt-2 text-xs text-slate-500">{state.dataCoverage}</p>
              {state.notes && <p className="mt-1 text-xs text-amber-800">{state.notes}</p>}
              {state.supported && state.portalUrl && (
                <a
                  href={state.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm text-brand-600 hover:underline"
                >
                  State portal ↗
                </a>
              )}
              {state.supported && state.stateCode === "MAHARASHTRA" && (
                <Link href="/my-chances" className="ml-4 mt-3 inline-block text-sm text-brand-600 hover:underline">
                  My MH options →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {mhEvents.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Maharashtra CAP timeline (expected)</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {mhEvents.map((e) => (
              <li key={e.title}>
                {e.title} — {formatEventRange(e.startAt, e.endAt)}
                {eventPhase(e.startAt, e.endAt) === "active" && (
                  <Badge className="ml-2 bg-red-100 text-red-800">Active</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/calendar" className="card p-4 hover:shadow-md">
          <p className="font-medium">Counselling calendar</p>
          <p className="text-sm text-slate-500">All dates in one place</p>
        </Link>
        <Link href="/documents" className="card p-4 hover:shadow-md">
          <p className="font-medium">Document checklist</p>
          <p className="text-sm text-slate-500">Registration prep</p>
        </Link>
        <Link href="/preferences" className="card p-4 hover:shadow-md">
          <p className="font-medium">Choice list</p>
          <p className="text-sm text-slate-500">Build & reorder</p>
        </Link>
      </div>
    </div>
  );
}
