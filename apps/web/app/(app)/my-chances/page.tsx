import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { normalizePreferredCities, normalizePriorities } from "@medcounsel/types";
import { MyChancesSearch } from "@/components/prediction/my-chances-search";

export default async function MyChancesPage({
  searchParams,
}: {
  searchParams: Promise<{ fit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!profile) redirect("/");

  const params = await searchParams;
  const validFits = new Set(["STRONG", "POSSIBLE", "BORDERLINE", "DIFFICULT"]);
  const initialFitFilter = params.fit && validFits.has(params.fit) ? params.fit : "";

  return (
    <MyChancesSearch
      initialFitFilter={initialFitFilter}
      profile={{
        rank: profile.rank,
        rankType: profile.rankType as "AIR" | "SML",
        category: profile.category,
        domicileState: profile.domicileState,
        counsellingPref: profile.counsellingPref,
        collegePref: profile.collegePref,
        degreePref: (profile.degreePref as "ALL" | "MD" | "MS" | "DNB") ?? "ALL",
        budgetRange: profile.budgetRange,
        preferredSpecialties: JSON.parse(profile.preferredSpecialties || "[]"),
        preferredCities: normalizePreferredCities(
          JSON.parse(profile.preferredCities || "[]") as string[]
        ),
        priorityRanking: normalizePriorities(
          JSON.parse(profile.priorityRanking || "[]") as string[]
        ),
      }}
    />
  );
}
