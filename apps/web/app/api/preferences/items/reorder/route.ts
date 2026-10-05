import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId, direction } = await req.json();
  const item = await prisma.preferenceItem.findUnique({
    where: { id: itemId },
    include: { list: true },
  });
  if (!item || item.list.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await prisma.preferenceItem.findMany({
    where: { listId: item.listId },
    orderBy: { sortOrder: "asc" },
  });

  const idx = items.findIndex((i) => i.id === itemId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) {
    return NextResponse.json({ ok: true });
  }

  const current = items[idx];
  const swap = items[swapIdx];

  await prisma.$transaction([
    prisma.preferenceItem.update({ where: { id: current.id }, data: { sortOrder: swap.sortOrder } }),
    prisma.preferenceItem.update({ where: { id: swap.id }, data: { sortOrder: current.sortOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
