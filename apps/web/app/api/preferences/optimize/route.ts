import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { generatePredictions } from "@/lib/predictions";
import { optimizeChoiceOrder, type ChoiceListItem } from "@/lib/choice-optimize";
import { normalizePreferredCities, normalizePriorities } from "@medcounsel/types";
import { displayCollegeName } from "@medcounsel/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const apply = body.apply === true;

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Complete your profile first" }, { status: 400 });
  }

  const list = await prisma.preferenceList.findFirst({
    where: { userId: session.user.id, status: "DRAFT" },
    include: {
      items: {
        include: { college: true, specialty: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!list?.items.length) {
    return NextResponse.json({ error: "Add choices before optimizing" }, { status: 400 });
  }

  const input = {
    rank: profile.rank,
    rankType: profile.rankType as "AIR" | "SML",
    category: profile.category,
    domicileState: profile.domicileState,
    counsellingPref: profile.counsellingPref as "AIQ" | "STATE" | "BOTH",
    collegePref: profile.collegePref,
    budgetRange: profile.budgetRange,
    preferredSpecialties: JSON.parse(profile.preferredSpecialties || "[]") as string[],
    preferredCities: normalizePreferredCities(JSON.parse(profile.preferredCities || "[]") as string[]),
    priorityRanking: normalizePriorities(JSON.parse(profile.priorityRanking || "[]") as string[]),
  };

  const predictions = await generatePredictions(input, { limit: 500 });

  const items: ChoiceListItem[] = list.items.map((item) => {
    const snap = JSON.parse(item.fitSnapshot || "{}") as { fitLevel?: string };
    return {
      id: item.id,
      collegeId: item.collegeId,
      specialtyId: item.specialtyId,
      collegeName: displayCollegeName(item.college.name),
      specialtyName: item.specialty.name,
      degree: item.specialty.degree,
      state: item.college.state,
      city: item.college.city,
      fitLevel: snap.fitLevel as ChoiceListItem["fitLevel"],
    };
  });

  const optimized = optimizeChoiceOrder(items, predictions, input);

  if (apply) {
    await prisma.$transaction(
      optimized.map((row, index) =>
        prisma.preferenceItem.update({
          where: { id: row.id },
          data: { sortOrder: index + 1 },
        })
      )
    );
  }

  return NextResponse.json({
    priorities: input.priorityRanking,
    suggested: optimized.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      collegeName: row.collegeName,
      specialtyLabel: `${row.degree} ${row.specialtyName}`,
      fitLevel: row.fitLevel,
      explanation: row.explanation,
    })),
    applied: apply,
  });
}
