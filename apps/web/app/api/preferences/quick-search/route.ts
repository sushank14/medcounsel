import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { excludeDemoCollegesWhere } from "@medcounsel/types";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const state = searchParams.get("state")?.trim();
  const degree = searchParams.get("degree")?.trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const colleges = await prisma.college.findMany({
    where: {
      ...excludeDemoCollegesWhere,
      ...(state ? { state } : {}),
      OR: [{ name: { contains: q } }, { city: { contains: q } }, { shortName: { contains: q } }],
    },
    take: 12,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      state: true,
      city: true,
      slug: true,
      specialties: {
        take: 12,
        where: degree ? { specialty: { degree: degree as never } } : undefined,
        include: {
          specialty: { select: { id: true, name: true, degree: true, slug: true } },
        },
      },
    },
  });

  const results: {
    collegeId: string;
    specialtyId: string;
    collegeName: string;
    state: string;
    degree: string;
    specialtyName: string;
    slug: string;
  }[] = [];

  for (const c of colleges) {
    for (const link of c.specialties) {
      results.push({
        collegeId: c.id,
        specialtyId: link.specialty.id,
        collegeName: c.shortName || c.name,
        state: c.state,
        degree: link.specialty.degree,
        specialtyName: link.specialty.name,
        slug: c.slug,
      });
      if (results.length >= 25) break;
    }
    if (results.length >= 25) break;
  }

  return NextResponse.json({ results });
}
