import { NextResponse } from "next/server";
import { lookupByAir, lookupByAirExact, loadMaharashtraAirSmlIndex } from "@/lib/maharashtra-air-sml-index";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const limited = rateLimit(`air-sml:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }
  const { searchParams } = new URL(req.url);
  const airRaw = searchParams.get("air")?.trim();
  const air = airRaw ? parseInt(airRaw, 10) : NaN;

  if (!Number.isFinite(air) || air < 1) {
    return NextResponse.json({ error: "Provide ?air= with a valid NEET PG All India Rank" }, { status: 400 });
  }

  const index = loadMaharashtraAirSmlIndex();
  if (!index) {
    return NextResponse.json(
      {
        error:
          "AIR↔SML index not on server. Admin: npm run fetch:maharashtra && npm run import:maharashtra-air-sml",
      },
      { status: 503 }
    );
  }

  const exact = lookupByAirExact(air);
  const result = exact.found ? exact : lookupByAir(air);

  return NextResponse.json({
    air: result.air,
    smlRank: exact.found ? exact.smlRank : result.estimated ? result.smlRank : 0,
    found: exact.found,
    estimated: !exact.found && result.estimated,
    officialSmlRank: exact.found ? exact.smlRank : null,
    category: result.data?.category,
    categoryRaw: result.data?.categoryRaw,
    neetScore: result.data?.neetScore,
    neetRoll: result.data?.neetRoll,
    neighbors:
      result.lower && result.upper
        ? { lower: result.lower, upper: result.upper }
        : undefined,
    source: {
      year: index.year,
      listLabel: index.listLabel,
      sourceUrl: index.sourceUrl,
      totalCandidates: index.totalRows,
    },
    disclaimer:
      "Official SML only when your AIR appears on the MAHACET Cap-III registered list. Interpolated values are UI hints only — My Chances uses exact matches or your entered SML, never estimated SML. AIR and SML are not interchangeable.",
  });
}
