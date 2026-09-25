import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  let list = await prisma.preferenceList.findFirst({
    where: { userId: session.user.id, status: "DRAFT" },
  });

  if (!list) {
    list = await prisma.preferenceList.create({
      data: { userId: session.user.id, title: "My 2026 Preference List", year: 2026 },
    });
  }

  const existing = await prisma.preferenceItem.findFirst({
    where: { listId: list.id, collegeId: body.collegeId, specialtyId: body.specialtyId },
  });
  if (existing) {
    return NextResponse.json({ error: "Duplicate entry" }, { status: 409 });
  }

  const maxOrder = await prisma.preferenceItem.aggregate({
    where: { listId: list.id },
    _max: { sortOrder: true },
  });

  const item = await prisma.preferenceItem.create({
    data: {
      listId: list.id,
      collegeId: body.collegeId,
      specialtyId: body.specialtyId,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      fitSnapshot: JSON.stringify(body.fitSnapshot ?? {}),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.preferenceItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
