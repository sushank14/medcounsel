import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { generatePredictions } from "@/lib/predictions";
import { Button } from "@/components/ui/button";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import {
  CHOICE_TIER_LABELS,
  fitLevelToTier,
  normalizePreferredCities,
  normalizePriorities,
  type ChoiceTier,
  type PredictionResult,
} from "@medcounsel/types";
import { formatRank } from "@/lib/utils";
import {
  getNextActions,
  getTrackStatuses,
  upcomingDeadlines,
} from "@/lib/counselling-guidance";
import { WhatShouldIDoNow } from "@/components/counselling/what-should-i-do-now";
import { CounsellingStatusPanel } from "@/components/counselling/counselling-status-panel";
import { UpcomingDeadlines } from "@/components/counselling/upcoming-deadlines";
import { Badge } from "@/components/ui/badge";
import { displayCollegeName } from "@medcounsel/types";

function topByTier(predictions: PredictionResult[], tier: ChoiceTier, limit = 2) {
  return predictions.filter((p) => fitLevelToTier(p.fitLevel) === tier).slice(0, limit);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!profile) {
    if (session.user.role === "ADMIN") redirect("/admin");
    redirect("/onboarding");
  }

  const prefList = await prisma.preferenceList.findFirst({
    where: { userId: session.user.id, status: "DRAFT" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { college: true, specialty: true },
      },
    },
  });

  const preferredSpecialties = JSON.parse(profile.preferredSpecialties || "[]") as string[];

  const predictions = await generatePredictions(
    {
      rank: profile.rank,
      rankType: profile.rankType as "AIR" | "SML",
      category: profile.category,
      domicileState: profile.domicileState,
      counsellingPref: profile.counsellingPref as "AIQ" | "STATE" | "BOTH",
      collegePref: profile.collegePref,
      degreeFilter:
        profile.degreePref && profile.degreePref !== "ALL"
          ? (profile.degreePref as "MD" | "MS" | "DNB")
          : undefined,
      budgetRange: profile.budgetRange,
      preferredSpecialties,
      preferredCities: normalizePreferredCities(JSON.parse(profile.preferredCities || "[]") as string[]),
      priorityRanking: normalizePriorities(JSON.parse(profile.priorityRanking || "[]") as string[]),
    },
    { limit: 100 }
  );

  const nextActions = getNextActions({
    hasProfile: true,
    counsellingPref: profile.counsellingPref,
    domicileState: profile.domicileState,
    choiceListCount: prefList?.items.length ?? 0,
  });

  const tracks = getTrackStatuses();
  const deadlines = upcomingDeadlines(5);
  const prefItems = prefList?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-600">Counselling command center</p>
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-slate-600">NEET-PG 2026–27 · What to do, where you stand, what to pick next</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/my-chances">
            <Button size="sm">Analyze my rank</Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="outline" size="sm">Edit profile</Button>
          </Link>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">My counselling profile</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Rank</p>
            <p className="text-lg font-semibold">{formatRank(profile.rank, profile.rankType)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Category</p>
            <p className="text-lg font-semibold">{profile.category}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Domicile</p>
            <p className="text-lg font-semibold">{profile.domicileState}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Counselling</p>
            <p className="text-lg font-semibold">{profile.counsellingPref}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Course filter</p>
            <p className="text-lg font-semibold">{profile.degreePref ?? "ALL"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Budget</p>
            <p className="text-lg font-semibold">{profile.budgetRange.replace(/_/g, " ")}</p>
          </div>
          {preferredSpecialties.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-slate-500">Preferred branches</p>
              <p className="text-sm font-medium">{preferredSpecialties.join(", ")}</p>
            </div>
          )}
        </div>
      </section>

      <WhatShouldIDoNow actions={nextActions} />
      <CounsellingStatusPanel tracks={tracks} />
      <UpcomingDeadlines deadlines={deadlines} />

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My saved choices</h2>
          <Link href="/preferences" className="text-sm text-brand-600 hover:underline">
            Manage list →
          </Link>
        </div>
        {prefItems.length === 0 ? (
          <p className="text-sm text-slate-500">
            No choices saved yet. Add options from{" "}
            <Link href="/my-chances" className="text-brand-600 hover:underline">
              My Chances
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{prefItems.length}</span> choices · Top:{" "}
              {prefItems[0].specialty.degree} {prefItems[0].specialty.name} @{" "}
              {displayCollegeName(prefItems[0].college.name)}
              {prefItems.length > 1 && (
                <>
                  {" "}
                  · Backup: {prefItems[prefItems.length - 1].specialty.degree}{" "}
                  {prefItems[prefItems.length - 1].specialty.name}
                </>
              )}
            </p>
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My top options</h2>
          <Link href="/my-chances" className="text-sm text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="space-y-6">
          {(["TARGET", "REALISTIC", "BACKUP", "DREAM"] as ChoiceTier[]).map((tier) => {
            const items = topByTier(predictions, tier, 2);
            if (!items.length) return null;
            return (
              <div key={tier}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-brand-50 text-brand-800">{CHOICE_TIER_LABELS[tier].label}</Badge>
                  <span className="text-xs text-slate-500">{CHOICE_TIER_LABELS[tier].description}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((r) => (
                    <PredictionCard key={`${r.collegeId}-${r.specialtyId}-${r.counsellingCode}`} result={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {predictions.length === 0 && (
          <div className="card p-6 text-center text-slate-600">
            <p>No matching options — try widening college type or budget in your profile.</p>
          </div>
        )}
      </section>

      <DisclaimerBanner compact />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/counselling" className="card p-4 hover:shadow-md">
          <p className="font-medium">Counselling hub</p>
          <p className="text-sm text-slate-500">AIQ vs State</p>
        </Link>
        <Link href="/preferences" className="card p-4 hover:shadow-md">
          <p className="font-medium">Choice list</p>
          <p className="text-sm text-slate-500">Build & reorder</p>
        </Link>
        <Link href="/compare" className="card p-4 hover:shadow-md">
          <p className="font-medium">Compare</p>
          <p className="text-sm text-slate-500">Up to 3 options</p>
        </Link>
        <Link href="/documents" className="card p-4 hover:shadow-md">
          <p className="font-medium">Documents</p>
          <p className="text-sm text-slate-500">Registration checklist</p>
        </Link>
      </div>
    </div>
  );
}
