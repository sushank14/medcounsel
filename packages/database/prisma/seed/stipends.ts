import { PrismaClient, College } from "@prisma/client";

export async function seedStipends(prisma: PrismaClient, colleges: College[]) {
  const demoSource = await prisma.source.findFirst({ where: { authority: "DEMO" } });

  for (const college of colleges) {
    const isCentral = college.collegeType === "CENTRAL";
    const isGovt = college.collegeType === "GOVT" || isCentral;

    const baseMonthly = isCentral ? 56100 : isGovt ? 65000 : 45000;
    const da = isCentral ? 0 : isGovt ? 12000 : 8000;

    for (const [year, multiplier] of [
      ["Y1", 1] as const,
      ["Y2", 1.05] as const,
      ["Y3", 1.1] as const,
    ]) {
      const monthly = Math.round(baseMonthly * multiplier);
      await prisma.stipend.create({
        data: {
          collegeId: college.id,
          traineeType: "PG_RESIDENT",
          yearOfTraining: year,
          monthlyAmount: monthly,
          payScale: isCentral ? "7th CPC Level 10" : "State residency scale (DEMO)",
          da,
          otherAllowances: isCentral ? 5000 : 3000,
          totalMonthly: monthly + da + (isCentral ? 5000 : 3000),
          academicYear: 2025,
          sourceId: demoSource?.id,
          verifiedAt: new Date(),
          verificationStatus: "PENDING",
        },
      });
    }
  }

  console.log(`  Stipends for ${colleges.length} colleges (DEMO — verify with NMC/college sources)`);
}
