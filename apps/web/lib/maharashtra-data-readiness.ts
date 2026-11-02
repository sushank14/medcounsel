import { prisma } from "@medcounsel/database";

export type Maharashtra2025Readiness = {
  predictionReady: boolean;
  validatedAt?: string;
  checks?: Array<{ name: string; ok: boolean; detail?: string }>;
  counts?: {
    cutoffsVerified?: number;
    seatMatrices?: number;
    documents?: number;
    cutoffsByRound?: Record<string, number>;
  };
};

export async function getMaharashtra2025Readiness(): Promise<Maharashtra2025Readiness> {
  const counselling = await prisma.counselling.findUnique({ where: { code: "MAHARASHTRA" } });
  if (!counselling?.config) {
    return { predictionReady: false };
  }
  try {
    const config = JSON.parse(counselling.config) as { maharashtra2025?: Maharashtra2025Readiness };
    const m: Maharashtra2025Readiness = config.maharashtra2025 ?? { predictionReady: false };
    return {
      predictionReady: m.predictionReady === true,
      validatedAt: m.validatedAt,
      checks: m.checks,
      counts: m.counts,
    };
  } catch {
    return { predictionReady: false };
  }
}
