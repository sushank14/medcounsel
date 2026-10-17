import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { resolveSeatMatrixFilters, type SeatMatrixSearchParams } from "@/lib/seat-matrix-filters";

const MAX_BULK = 400;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    items?: { collegeId: string; specialtyId: string }[];
    seatMatrixFilters?: SeatMatrixSearchParams;
    scope?: "all" | "page";
    page?: number;
    pageSize?: number;
    fitSnapshot?: Record<string, unknown>;
  };

  let pairs: { collegeId: string; specialtyId: string }[] = [];

  if (body.items?.length) {
    pairs = body.items;
  } else if (body.seatMatrixFilters) {
    const { where } = resolveSeatMatrixFilters(body.seatMatrixFilters);
    const pageSize = body.pageSize ?? 50;
    const page = Math.max(1, body.page ?? 1);

    if (body.scope === "page") {
      const pageRows = await prisma.seatMatrix.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: { collegeId: true, specialtyId: true },
      });
      pairs = pageRows;
    } else {
      const groups = await prisma.seatMatrix.groupBy({
        by: ["collegeId", "specialtyId"],
        where,
      });
      pairs = groups.slice(0, MAX_BULK);
    }
  } else {
    return NextResponse.json({ error: "Provide items or seatMatrixFilters" }, { status: 400 });
  }

  const unique = new Map<string, { collegeId: string; specialtyId: string }>();
  for (const p of pairs) {
    if (!p.collegeId || !p.specialtyId) continue;
    unique.set(`${p.collegeId}|${p.specialtyId}`, p);
  }

  let list = await prisma.preferenceList.findFirst({
    where: { userId: session.user.id, status: "DRAFT" },
  });
  if (!list) {
    list = await prisma.preferenceList.create({
      data: { userId: session.user.id, title: "My 2026 Preference List", year: 2026 },
    });
  }

  const existing = await prisma.preferenceItem.findMany({
    where: { listId: list.id },
    select: { collegeId: true, specialtyId: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.collegeId}|${e.specialtyId}`));

  const maxOrder = await prisma.preferenceItem.aggregate({
    where: { listId: list.id },
    _max: { sortOrder: true },
  });
  let sortOrder = maxOrder._max.sortOrder ?? 0;

  const snapshot = JSON.stringify(body.fitSnapshot ?? { source: "seat-matrix" });
  let added = 0;
  let skipped = 0;

  for (const p of unique.values()) {
    const key = `${p.collegeId}|${p.specialtyId}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    sortOrder++;
    await prisma.preferenceItem.create({
      data: {
        listId: list.id,
        collegeId: p.collegeId,
        specialtyId: p.specialtyId,
        sortOrder,
        fitSnapshot: snapshot,
      },
    });
    existingKeys.add(key);
    added++;
  }

  return NextResponse.json({
    added,
    skipped,
    total: unique.size,
    capped: body.scope !== "page" && unique.size >= MAX_BULK,
  });
}
