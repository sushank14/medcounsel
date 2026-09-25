import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await prisma.candidateProfile.updateMany({
    where: { userId: session.user.id },
    data: { isActive: false },
  });

  const rankType =
    body.rankType ??
    (body.domicileState === "Maharashtra" && body.counsellingPref !== "AIQ" ? "SML" : "AIR");

  const profile = await prisma.candidateProfile.create({
    data: {
      userId: session.user.id,
      neetPgYear: parseInt(String(body.neetPgYear), 10),
      rank: parseInt(String(body.rank), 10),
      rankType,
      category: body.category,
      gender: body.gender,
      domicileState: body.domicileState,
      counsellingPref: body.counsellingPref,
      preferredSpecialties: JSON.stringify(body.preferredSpecialties ?? []),
      preferredCities: JSON.stringify(body.preferredCities ?? []),
      collegePref: body.collegePref,
      budgetRange: body.budgetRange,
      priorityRanking: JSON.stringify(body.priorityRanking ?? []),
      isActive: true,
    },
  });

  return NextResponse.json(profile);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      ...(body.priorityRanking ? { priorityRanking: JSON.stringify(body.priorityRanking) } : {}),
      ...(body.preferredSpecialties
        ? { preferredSpecialties: JSON.stringify(body.preferredSpecialties) }
        : {}),
      ...(body.preferredCities
        ? { preferredCities: JSON.stringify(body.preferredCities) }
        : {}),
      ...(body.rank !== undefined ? { rank: parseInt(String(body.rank), 10) } : {}),
      ...(body.rankType ? { rankType: body.rankType } : {}),
      ...(body.category ? { category: body.category } : {}),
      ...(body.gender ? { gender: body.gender } : {}),
      ...(body.domicileState ? { domicileState: body.domicileState } : {}),
      ...(body.counsellingPref ? { counsellingPref: body.counsellingPref } : {}),
      ...(body.collegePref ? { collegePref: body.collegePref } : {}),
      ...(body.budgetRange ? { budgetRange: body.budgetRange } : {}),
    },
  });

  return NextResponse.json(updated);
}
