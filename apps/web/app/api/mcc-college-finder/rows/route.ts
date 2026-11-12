import { NextResponse } from "next/server";
import { recordsByIds } from "@/lib/mcc-college-finder-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((item): item is string => typeof item === "string").slice(0, 500) : [];
  return NextResponse.json({ rows: recordsByIds(ids) });
}
