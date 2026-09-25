import { PrismaClient, College, Specialty } from "@prisma/client";

export async function seedFeesAndBonds(
  prisma: PrismaClient,
  colleges: College[],
  _specialties: Specialty[]
) {
  const demoSource = await prisma.source.findFirst({ where: { authority: "DEMO" } });

  for (const college of colleges) {
    const isGovt = college.collegeType === "GOVT" || college.collegeType === "CENTRAL";
    const tuition = isGovt ? 75000 : college.collegeType === "DEEMED" ? 2500000 : 1800000;
    const hostel = isGovt ? 12000 : 150000;

    await prisma.fee.create({
      data: {
        collegeId: college.id,
        academicYear: 2025,
        tuitionFee: tuition,
        hostelFee: hostel,
        otherFees: isGovt ? 5000 : 50000,
        totalAnnual: tuition + hostel + (isGovt ? 5000 : 50000),
        sourceId: demoSource?.id,
        verifiedAt: new Date(),
      },
    });

    if (college.state === "Maharashtra" && college.collegeType === "GOVT") {
      await prisma.bond.create({
        data: {
          collegeId: college.id,
          durationYears: 1,
          bondAmount: 1000000,
          serviceObligation: "1 year rural service in Maharashtra (DEMO data — verify with official authority)",
          sourceId: demoSource?.id,
          verifiedAt: new Date(),
        },
      });
    }
  }

  console.log(`  Fees and bonds for ${colleges.length} colleges`);
}
