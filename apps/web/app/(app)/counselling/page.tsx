import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import {
  AIQ_COUNSELLING,
  STATE_COUNSELLING_REGISTRY,
  NEET_PG_2026_SESSION,
} from "@medcounsel/types";
import { getTrackStatuses } from "@/lib/counselling-guidance";
import { eventsByCounselling, formatEventRange, eventPhase } from "@/lib/counselling-calendar";
import { CounsellingStatusPanel } from "@/components/counselling/counselling-status-panel";
import { SmlLookupForm } from "@/components/counselling/sml-lookup-form";
import { loadMaharashtraMeritIndex } from "@/lib/maharashtra-merit-index";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export default async function CounsellingHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  const tracks = getTrackStatuses();
  const aiqEvents = eventsByCounselling("AIQ");
  const mhEvents = eventsByCounselling("MAHARASHTRA");
  const mhMeritIndex = loadMaharashtraMeritIndex();

  const reservedCategories = new Set(["OBC", "SC", "ST", "EWS", "PWD"]);
  const showCategoryExplorer = profile && reservedCategories.has(profile.category);

  return (
    <div className="page">
      <PageHeader
        kicker={`NEET-PG ${NEET_PG_2026_SESSION.academicYear}`}
        title="Counselling Hub"
        description="AIQ and state tracks — official links, rounds, and what's active now."
      />

      <DisclaimerBanner compact />
      <CounsellingStatusPanel tracks={tracks} />

      {showCategoryExplorer && (
        <section className="card card-body border-violet-200 bg-violet-50/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-violet-950">Category & quota explorer</h2>
              <p className="mt-1 text-sm text-violet-900/90">
                You&apos;re in category <strong>{profile!.category}</strong>. Compare closing ranks across
                General, OBC, SC, ST, EWS, and PwD for the same college and branch — cutoffs differ
                significantly by category.
              </p>
            </div>
            <Link href="/category-explorer">
              <Button size="sm">Open category explorer</Button>
            </Link>
          </div>
        </section>
      )}

      {profile?.category === "GENERAL" && (
        <section className="card card-tile text-sm text-slate-600">
          <p>
            <Link href="/category-explorer" className="font-medium text-brand-600 hover:underline">
              Category explorer
            </Link>{" "}
            — see how cutoffs differ for OBC, SC, ST, EWS, and PwD candidates at the same institute.
          </p>
        </section>
      )}

      <section className="card card-body section-block">
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
          <Link href="/seat-matrix">
            <Button variant="outline" size="sm">Seat matrix</Button>
          </Link>
          <Link href="/mcc-round-2">
            <Button variant="outline" size="sm">MCC Round 2</Button>
          </Link>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Round timeline (MCC official · Maharashtra expected)</summary>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {aiqEvents.map((e) => (
              <li key={e.title} className="flex flex-wrap gap-2">
                <span>{e.round ?? "—"}</span>
                <span>{e.title}</span>
                <span className="text-slate-400">{formatEventRange(e.startAt, e.endAt)}</span>
                {e.status === "official" && (
                  <Badge className="bg-emerald-50 text-emerald-800 text-[10px]">MCC official</Badge>
                )}
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
            <div key={state.stateCode} className="card card-tile">
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
                <span className="mt-3 block space-x-3">
                  <Link href="/my-chances" className="text-sm text-brand-600 hover:underline">
                    My MH options →
                  </Link>
                  <Link href="/maharashtra/rank-map" className="text-sm text-brand-600 hover:underline">
                    AIR ↔ SML map →
                  </Link>
                  <Link
                    href="/seat-matrix?source=maharashtra&year=2026"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Seats vs 2025 ranks →
                  </Link>
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {mhMeritIndex && (
        <section className="section-block">
          <SmlLookupForm />
        </section>
      )}

      {mhEvents.length > 0 && (
        <section className="card card-body section-block">
          <h2 className="mb-3 font-semibold">Maharashtra CAP timeline</h2>
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
        <Link href="/calendar" className="card card-tile hover:shadow-md">
          <p className="font-medium">Counselling calendar</p>
          <p className="text-sm text-slate-500">All dates in one place</p>
        </Link>
        <Link href="/documents" className="card card-tile hover:shadow-md">
          <p className="font-medium">Document checklist</p>
          <p className="text-sm text-slate-500">Registration prep</p>
        </Link>
        <Link href="/preferences" className="card card-tile hover:shadow-md">
          <p className="font-medium">Choice list</p>
          <p className="text-sm text-slate-500">Build & reorder</p>
        </Link>
      </div>
    </div>
  );
}
