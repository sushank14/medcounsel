import { PrismaClient } from "@prisma/client";

export async function seedCounsellings(prisma: PrismaClient) {
  const aiq = await prisma.counselling.upsert({
    where: { code: "AIQ" },
    update: {},
    create: {
      code: "AIQ",
      name: "MCC All India Quota (AIQ)",
      type: "MCC",
      authority: "Medical Counselling Committee (MCC)",
      portalUrl: "https://mcc.nic.in/pg-medical-counselling/",
      rankType: "AIR",
      config: JSON.stringify({ quota: "50% AIQ seats" }),
    },
  });

  const maharashtra = await prisma.counselling.upsert({
    where: { code: "MAHARASHTRA" },
    update: {},
    create: {
      code: "MAHARASHTRA",
      name: "Maharashtra State Counselling (CAP)",
      type: "STATE",
      authority: "State CET Cell, Maharashtra",
      portalUrl: "https://medicalug2025.mahacet.org/",
      rankType: "SML",
      config: JSON.stringify({ quota: "85% state quota", domicileRequired: true }),
    },
  });

  const karnataka = await prisma.counselling.upsert({
    where: { code: "KARNATAKA" },
    update: {},
    create: {
      code: "KARNATAKA",
      name: "Karnataka State Counselling (KEA)",
      type: "STATE",
      authority: "Karnataka Examinations Authority",
      portalUrl: "https://cetonline.karnataka.gov.in/",
      rankType: "AIR",
      config: JSON.stringify({ note: "OPN seats use AIR" }),
    },
  });

  const roundDefs: { counsellingId: string; year: number; round: "R1" | "R2" | "R3" }[] = [];
  for (const counsellingId of [aiq.id, maharashtra.id, karnataka.id]) {
    for (const year of [2023, 2024, 2025]) {
      for (const round of ["R1", "R2", "R3"] as const) {
        roundDefs.push({ counsellingId, year, round });
      }
    }
  }
  const rounds = roundDefs;

  const createdRounds = [];
  for (const r of rounds) {
    const round = await prisma.counsellingRound.upsert({
      where: {
        counsellingId_year_round: {
          counsellingId: r.counsellingId,
          year: r.year,
          round: r.round,
        },
      },
      update: {},
      create: r,
    });
    createdRounds.push(round);
  }

  console.log(`  ${3} counsellings, ${createdRounds.length} rounds`);
  return { aiq, maharashtra, karnataka, rounds: createdRounds };
}
