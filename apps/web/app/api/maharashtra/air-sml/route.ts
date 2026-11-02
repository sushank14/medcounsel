import { NextResponse } from "next/server";
import { lookupByAir, loadMaharashtraAirSmlIndex } from "@/lib/maharashtra-air-sml-index";

export async function GET(req: Request) {
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

  const result = lookupByAir(air);

  return NextResponse.json({
    air: result.air,
    smlRank: result.smlRank,
    found: result.found,
    estimated: result.estimated,
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
      "SML from official CET registered-candidate list. Interpolation between nearest published AIRs is marked estimated. AIR and SML are not interchangeable for counselling.",
  });
}
