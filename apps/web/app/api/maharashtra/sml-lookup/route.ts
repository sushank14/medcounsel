import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lookupSmlByNeetRoll, loadMaharashtraMeritIndex } from "@/lib/maharashtra-merit-index";

export async function GET(req: Request) {
  const limited = rateLimit(`sml-lookup:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const roll = searchParams.get("roll")?.trim();
  if (!roll) {
    return NextResponse.json({ error: "Provide ?roll= NEET PG roll number" }, { status: 400 });
  }

  const index = loadMaharashtraMeritIndex();
  if (!index) {
    return NextResponse.json(
      { error: "Merit index not loaded on this server. Admin: npm run import:maharashtra-merit" },
      { status: 503 }
    );
  }

  const hit = lookupSmlByNeetRoll(roll);
  if (!hit) {
    return NextResponse.json(
      { found: false, roll: roll.replace(/\D/g, ""), year: index.year, round: index.round },
      { status: 404 }
    );
  }

  return NextResponse.json({
    found: true,
    roll: roll.replace(/\D/g, ""),
    smlRank: hit.smlRank,
    neetScore: hit.neetScore,
    category: hit.category,
    categoryRaw: hit.categoryRaw || undefined,
    categoryMeritNo: hit.categoryMeritNo,
    candidatureType: hit.candidatureType,
    year: index.year,
    round: index.round,
    provisional: true,
    sourceUrl: index.sourceUrl,
  });
}
