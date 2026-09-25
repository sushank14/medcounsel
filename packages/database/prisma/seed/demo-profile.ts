import { PrismaClient } from "@prisma/client";

/** Optional manual seed — normal flow is each user creating their profile at /onboarding */
export async function seedDemoProfile(
  prisma: PrismaClient,
  userId: string,
  data?: {
    rank?: number;
    rankType?: "AIR" | "SML";
    category?: string;
    gender?: string;
    domicileState?: string;
  }
) {
  await prisma.candidateProfile.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  await prisma.candidateProfile.create({
    data: {
      userId,
      neetPgYear: 2026,
      rank: data?.rank ?? 15197,
      rankType: data?.rankType ?? "AIR",
      category: (data?.category ?? "OBC") as never,
      gender: (data?.gender ?? "FEMALE") as never,
      domicileState: data?.domicileState ?? "Maharashtra",
      counsellingPref: "BOTH",
      preferredSpecialties: JSON.stringify([]),
      preferredCities: JSON.stringify(["Pune", "Mumbai"]),
      collegePref: "ANY",
      budgetRange: "NO_RESTRICTION",
      priorityRanking: JSON.stringify([
        "Branch",
        "Location",
        "Government college",
        "Fees",
        "Stipend",
        "Bond",
      ]),
      isActive: true,
    },
  });

  console.log("  Candidate profile seeded (override via /onboarding in app)");
}
