import { NextResponse } from "next/server";
import { prisma } from "@medcounsel/database";
import { compareCategoriesForOption } from "@/lib/predictions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const collegeId = searchParams.get("collegeId");
  const specialtyId = searchParams.get("specialtyId");
  const counsellingCode = searchParams.get("counsellingCode");
  const rank = parseInt(searchParams.get("rank") ?? "0", 10);

  if (!collegeId || !specialtyId || !counsellingCode || !rank) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const counselling = await prisma.counselling.findUnique({ where: { code: counsellingCode } });
  if (!counselling) {
    return NextResponse.json({ error: "Counselling not found" }, { status: 404 });
  }

  const comparison = await compareCategoriesForOption(
    collegeId,
    specialtyId,
    counselling.id,
    rank
  );
  return NextResponse.json({ comparison });
}
