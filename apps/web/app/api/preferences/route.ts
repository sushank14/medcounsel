import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";

async function getOrCreateList(userId: string) {
  let list = await prisma.preferenceList.findFirst({
    where: { userId, status: "DRAFT" },
    include: {
      items: {
        include: { college: true, specialty: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!list) {
    list = await prisma.preferenceList.create({
      data: {
        userId,
        title: "My 2026 Preference List",
        year: 2026,
        status: "DRAFT",
      },
      include: {
        items: { include: { college: true, specialty: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  }

  return list;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await getOrCreateList(session.user.id);
  return NextResponse.json({ list });
}
