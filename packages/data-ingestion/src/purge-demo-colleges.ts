/** Remove all demo/placeholder colleges. Run: npx tsx src/purge-demo-colleges.ts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demos = await prisma.college.findMany({
    where: { OR: [{ slug: { startsWith: "demo-" } }, { dataStatus: "DEMO" }] },
    select: { id: true, slug: true, name: true },
  });

  for (const c of demos) {
    await prisma.prediction.deleteMany({ where: { collegeId: c.id } });
    await prisma.preferenceItem.deleteMany({ where: { collegeId: c.id } });
    await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
    await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
    await prisma.fee.deleteMany({ where: { collegeId: c.id } });
    await prisma.bond.deleteMany({ where: { collegeId: c.id } });
    await prisma.stipend.deleteMany({ where: { collegeId: c.id } });
    await prisma.seatMatrix.deleteMany({ where: { collegeId: c.id } });
    await prisma.college.delete({ where: { id: c.id } });
    console.log(`  ✗ ${c.slug}`);
  }

  const src = await prisma.source.deleteMany({ where: { authority: "DEMO" } });
  console.log(`\n✅ Removed ${demos.length} demo colleges, ${src.count} demo sources`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
