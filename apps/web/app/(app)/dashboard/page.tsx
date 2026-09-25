import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { generatePredictions } from "@/lib/predictions";
import { Button } from "@/components/ui/button";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { CounsellingUpdatesPanel } from "@/components/counselling/counselling-updates-panel";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { DataStatsBanner } from "@/components/layout/data-stats-banner";
import { normalizePreferredCities, normalizePriorities } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!profile) {
    if (session.user.role === "ADMIN") redirect("/admin");
    redirect("/");
  }

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
      preferredSpecialties: JSON.parse(profile.preferredSpecialties || "[]"),
      preferredCities: normalizePreferredCities(
        JSON.parse(profile.preferredCities || "[]") as string[]
      ),
      priorityRanking: normalizePriorities(
        JSON.parse(profile.priorityRanking || "[]") as string[]
      ),
    },
    { limit: 6 }
  );

  const topResults = predictions.slice(0, 6);
  const counts = {
    STRONG: predictions.filter((p) => p.fitLevel === "STRONG").length,
    POSSIBLE: predictions.filter((p) => p.fitLevel === "POSSIBLE").length,
    BORDERLINE: predictions.filter((p) => p.fitLevel === "BORDERLINE").length,
    DIFFICULT: predictions.filter((p) => p.fitLevel === "DIFFICULT").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your NEET-PG Profile</h1>
          <p className="text-slate-600">Personalized counselling intelligence dashboard</p>
        </div>
        <Link href="/onboarding"><Button variant="outline" size="sm">Edit profile</Button></Link>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-slate-500">Rank</p><p className="text-lg font-semibold">{formatRank(profile.rank, profile.rankType)}</p></div>
        <div><p className="text-xs text-slate-500">Category</p><p className="text-lg font-semibold">{profile.category}</p></div>
        <div><p className="text-xs text-slate-500">Domicile</p><p className="text-lg font-semibold">{profile.domicileState}</p></div>
        <div><p className="text-xs text-slate-500">Counselling</p><p className="text-lg font-semibold">{profile.counsellingPref}</p></div>
        {(() => {
          const cities = normalizePreferredCities(
            JSON.parse(profile.preferredCities || "[]") as string[]
          );
          if (!cities.length) return null;
          return (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-slate-500">Preferred cities</p>
              <p className="text-lg font-semibold">{cities.join(", ")}</p>
            </div>
          );
        })()}
      </div>

      <CounsellingUpdatesPanel compact />

      <DataStatsBanner />
      <DisclaimerBanner compact />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(counts).map(([level, count]) => (
          <div key={level} className="card p-4 text-center">
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-slate-500">{level.charAt(0) + level.slice(1).toLowerCase()}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Link href="/my-chances">
          <Button variant="outline" size="sm">View all options & edit filters →</Button>
        </Link>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Possible Options</h2>
          <Link href="/my-chances" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>
        {topResults.length === 0 ? (
          <div className="card p-8 text-center text-slate-600">
            <p className="font-medium">No matching options found for your profile.</p>
            <p className="mt-2 text-sm">Try setting college preference to &quot;Any&quot;, leave specialties blank, or use a broader budget.</p>
            <Link href="/onboarding" className="mt-4 inline-block text-brand-600 hover:underline">Edit profile →</Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {topResults.map((r) => (
              <PredictionCard key={`${r.collegeId}-${r.specialtyId}-${r.counsellingCode}`} result={r} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/simulator" className="card p-4 hover:shadow-md"><p className="font-medium">What-If Simulator</p><p className="text-sm text-slate-500">Change rank, category, budget</p></Link>
        <Link href="/preferences" className="card p-4 hover:shadow-md"><p className="font-medium">Preference List</p><p className="text-sm text-slate-500">Build your choice list</p></Link>
        <Link href="/calendar" className="card p-4 hover:shadow-md"><p className="font-medium">Counselling Calendar</p><p className="text-sm text-slate-500">Key dates & deadlines</p></Link>
      </div>
    </div>
  );
}
