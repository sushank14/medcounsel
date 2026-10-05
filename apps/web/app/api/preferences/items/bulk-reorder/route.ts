import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderedIds } = (await req.json()) as { orderedIds?: string[] };
  if (!orderedIds?.length) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  const list = await prisma.preferenceList.findFirst({
    where: { userId: session.user.id, status: "DRAFT" },
    include: { items: true },
  });

  if (!list) {
    return NextResponse.json({ error: "No list found" }, { status: 404 });
  }

  const owned = new Set(list.items.map((i) => i.id));
  if (orderedIds.some((id) => !owned.has(id)) || orderedIds.length !== list.items.length) {
    return NextResponse.json({ error: "Invalid item set" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.preferenceItem.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
