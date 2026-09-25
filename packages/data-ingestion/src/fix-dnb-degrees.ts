/**
 * Re-tag NBEMS-titled specialties as DNB degree.
 * Run: npx tsx src/fix-dnb-degrees.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nbems = await prisma.specialty.findMany({
    where: {
      OR: [
        { name: { contains: "NBEMS" } },
        { name: { contains: "nbems" } },
        { slug: { contains: "nbems" } },
      ],
      NOT: { degree: "DNB" },
    },
    select: { id: true, name: true, degree: true },
  });

  let updated = 0;
  for (const s of nbems) {
    await prisma.specialty.update({ where: { id: s.id }, data: { degree: "DNB" } });
    updated++;
  }

  const dnbCutoffs = await prisma.cutoff.count({
    where: { specialty: { degree: "DNB" } },
  });

  console.log(`✅ Retagged ${updated} NBEMS specialties as DNB`);
  console.log(`   Total DNB cutoffs now: ${dnbCutoffs}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
