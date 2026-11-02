import { NextResponse } from "next/server";
import { prisma } from "@medcounsel/database";
import { getMaharashtra2025Readiness } from "@/lib/maharashtra-data-readiness";

export async function GET() {
  try {
    const [colleges, cutoffs, mah] = await Promise.all([
      prisma.college.count(),
      prisma.cutoff.count({ where: { verificationStatus: "VERIFIED" } }),
      getMaharashtra2025Readiness(),
    ]);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: { colleges, verifiedCutoffs: cutoffs },
      maharashtra2025: { predictionReady: mah.predictionReady, validatedAt: mah.validatedAt },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Health check failed" },
      { status: 503 }
    );
  }
}
