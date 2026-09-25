import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { normalizePreferredCities, normalizePriorities } from "@medcounsel/types";
import { generatePredictions } from "@/lib/predictions";

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);

  let input;
  if (searchParams.get("simulator") === "true") {
    input = {
      rank: parseInt(searchParams.get("rank") ?? "0", 10),
      rankType: (searchParams.get("rankType") ?? "AIR") as "AIR" | "SML",
      category: searchParams.get("category") ?? "GENERAL",
      domicileState: searchParams.get("domicileState") ?? "Maharashtra",
      counsellingPref: (searchParams.get("counsellingPref") ?? "BOTH") as "AIQ" | "STATE" | "BOTH",
      collegePref: searchParams.get("collegePref") ?? "ANY",
      budgetRange: searchParams.get("budgetRange") ?? "NO_RESTRICTION",
      stateFilter: searchParams.get("state") ?? undefined,
      cityFilter: searchParams.get("city") ?? undefined,
      preferredSpecialties: searchParams.get("specialties")?.split(",").filter(Boolean),
      preferredCities: normalizePreferredCities(
        searchParams.get("cities")?.split(",").filter(Boolean)
      ),
      priorityRanking: normalizePriorities(
        searchParams.get("priorities")?.split(",").filter(Boolean)
      ),
    };
  } else if (session?.user?.id) {
    const profile = await prisma.candidateProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "No profile found" }, { status: 404 });
    }
    input = {
      rank: profile.rank,
      rankType: profile.rankType as "AIR" | "SML",
      category: profile.category,
      domicileState: profile.domicileState,
      counsellingPref: profile.counsellingPref as "AIQ" | "STATE" | "BOTH",
      collegePref: profile.collegePref,
      budgetRange: profile.budgetRange,
      preferredSpecialties: JSON.parse(profile.preferredSpecialties || "[]"),
      preferredCities: normalizePreferredCities(
        JSON.parse(profile.preferredCities || "[]") as string[]
      ),
      priorityRanking: normalizePriorities(
        JSON.parse(profile.priorityRanking || "[]") as string[]
      ),
      stateFilter: searchParams.get("state") ?? undefined,
      cityFilter: searchParams.get("city") ?? undefined,
      collegeTypeFilter: searchParams.get("type")?.split(",").filter(Boolean),
    };
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fitFilter = searchParams.get("fit") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 300);
  let results = await generatePredictions(input, { limit });
  if (fitFilter) {
    results = results.filter((r) => r.fitLevel === fitFilter);
  }

  return NextResponse.json({ results, count: results.length });
}
