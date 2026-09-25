import { PrismaClient, College, Specialty, Category, Quota } from "@prisma/client";

// Synthetic closing ranks for DEMO only — NOT real NEET-PG data
function demoClosingRank(baseRank: number, yearOffset: number, roundOffset: number): number {
  return Math.round(baseRank + yearOffset * 800 + roundOffset * 2500);
}

type CounsellingSeed = {
  aiq: { id: string };
  maharashtra: { id: string };
  karnataka: { id: string };
  demoSource: { id: string };
  rounds: { id: string; counsellingId: string; year: number; round: string }[];
};

const BASE_RANKS: Record<string, number> = {
  "md-general-medicine": 12000,
  "md-pediatrics": 14000,
  "md-radiodiagnosis": 8000,
  "md-dermatology": 6000,
  "md-psychiatry": 18000,
  "md-anaesthesiology": 20000,
  "md-pathology": 25000,
  "ms-general-surgery": 15000,
  "ms-orthopedics": 16000,
  "ms-obg": 13000,
  "ms-ophthalmology": 17000,
  "ms-ent": 22000,
  "md-emergency-medicine": 28000,
  "md-radiotherapy": 19000,
};

/** Demo category relaxation multipliers vs General (higher rank = easier admission). */
const CATEGORY_MULTIPLIERS: Record<Category, number> = {
  GENERAL: 1.0,
  EWS: 1.12,
  OBC: 1.35,
  SC: 2.05,
  ST: 2.55,
  PWD: 1.55,
};

const CATEGORIES: Category[] = ["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"];
const YEARS = [2023, 2024, 2025];
const ROUNDS = ["R1", "R2", "R3"] as const;

export async function seedCutoffs(
  prisma: PrismaClient,
  colleges: College[],
  specialties: Specialty[],
  counsellings: CounsellingSeed
) {
  await prisma.cutoff.deleteMany({});

  let count = 0;

  const roundMap = counsellings.rounds.reduce(
    (acc, r) => {
      acc[`${r.counsellingId}-${r.year}-${r.round}`] = r;
      return acc;
    },
    {} as Record<string, (typeof counsellings.rounds)[0]>
  );

  for (const college of colleges) {
    const collegeSpecs = await prisma.collegeSpecialty.findMany({
      where: { collegeId: college.id },
      include: { specialty: true },
    });

    for (const cs of collegeSpecs) {
      const base = BASE_RANKS[cs.specialty.slug] ?? 20000;
      const collegeModifier =
        college.collegeType === "CENTRAL" ? -3000 :
        college.collegeType === "DEEMED" ? 2000 :
        college.collegeType === "PRIVATE" ? 5000 : 0;

      const counsellingConfigs: { id: string; isState: boolean; rankType: "AIR" | "SML"; quota: Quota }[] = [];

      if (college.state === "Maharashtra") {
        counsellingConfigs.push(
          { id: counsellings.aiq.id, isState: false, rankType: "AIR", quota: "AIQ" },
          { id: counsellings.maharashtra.id, isState: true, rankType: "SML", quota: "STATE" }
        );
      } else if (college.state === "Karnataka") {
        counsellingConfigs.push(
          { id: counsellings.aiq.id, isState: false, rankType: "AIR", quota: "AIQ" },
          { id: counsellings.karnataka.id, isState: true, rankType: "AIR", quota: "STATE" }
        );
      } else {
        counsellingConfigs.push({ id: counsellings.aiq.id, isState: false, rankType: "AIR", quota: "AIQ" });
      }

      for (const cfg of counsellingConfigs) {
        const adjustedBase = cfg.isState ? Math.round(base * 0.15) : base + collegeModifier;

        for (const category of CATEGORIES) {
          const categoryBase = Math.round(adjustedBase * CATEGORY_MULTIPLIERS[category]);

          for (const year of YEARS) {
            const yearOffset = year === 2025 ? 0 : year === 2024 ? -1 : -2;

            for (const round of ROUNDS) {
              const roundRecord = roundMap[`${cfg.id}-${year}-${round}`];
              if (!roundRecord) continue;

              const roundOffset = round === "R1" ? 0 : round === "R2" ? 1 : 2;
              const closingRank = demoClosingRank(categoryBase, yearOffset, roundOffset);

              await prisma.cutoff.create({
                data: {
                  collegeId: college.id,
                  specialtyId: cs.specialtyId,
                  counsellingId: cfg.id,
                  roundId: roundRecord.id,
                  year,
                  category,
                  quota: cfg.quota,
                  closingRank,
                  rankType: cfg.rankType,
                  seats: Math.max(1, Math.floor(cs.totalSeats / CATEGORIES.length)),
                  sourceId: counsellings.demoSource.id,
                  verificationStatus: "PENDING",
                },
              });
              count++;
            }
          }
        }
      }
    }
  }

  console.log(`  ${count} demo cutoffs (${CATEGORIES.length} categories × ${YEARS.length} years)`);
}
