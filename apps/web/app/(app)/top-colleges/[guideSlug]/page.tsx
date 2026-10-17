import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { TOP_COLLEGES_DISCLAIMER } from "@medcounsel/types";
import { CuratedCollegeCard } from "@/components/college/curated-college-card";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { loadResolvedGuide } from "@/lib/top-colleges";
import { Button } from "@/components/ui/button";

export default async function TopCollegesGuidePage({
  params,
}: {
  params: Promise<{ guideSlug: string }>;
}) {
  const { guideSlug } = await params;
  const guide = await loadResolvedGuide(guideSlug);
  if (!guide) notFound();

  const session = await auth();
  let rankType: "AIR" | "SML" = "AIR";
  if (session?.user?.id) {
    const profile = await prisma.candidateProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { rankType: true },
    });
    if (profile?.rankType === "SML") rankType = "SML";
  }

  const found = guide.resolvedEntries.filter((e) => e.college).length;

  return (
    <div className="page">
      <div>
        <BackLink fallbackHref="/top-colleges" label="← Back" />
        <h1 className="mt-2 text-2xl font-bold">{guide.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{guide.description}</p>
        <p className="mt-1 text-xs text-slate-400">
          {found}/{guide.resolvedEntries.length} colleges matched in database
          {guide.specialtyLabel ? ` · Branch: ${guide.specialtyLabel}` : ""}
        </p>
      </div>

      <DisclaimerBanner compact />
      <p className="text-xs text-slate-500">{TOP_COLLEGES_DISCLAIMER}</p>

      <div className="space-y-3">
        {guide.resolvedEntries.map((entry) => (
          <CuratedCollegeCard
            key={`${entry.rank}-${entry.nameKeywords.join("-")}`}
            entry={entry}
            rankType={rankType}
            showBranch={!!guide.specialtyLabel}
            branchLabel={guide.specialtyLabel}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Link href="/my-chances">
          <Button>Check my chances for this branch →</Button>
        </Link>
        <Link href="/colleges">
          <Button variant="outline">Browse all colleges</Button>
        </Link>
      </div>
    </div>
  );
}
