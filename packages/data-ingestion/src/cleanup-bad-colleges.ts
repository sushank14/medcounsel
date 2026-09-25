import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const badColleges = await prisma.college.findMany({
    where: {
      OR: [
        { name: { startsWith: "&" } },
        { name: { contains: "& TB" } },
        { name: { contains: "& CRITICAL" } },
        { name: { contains: "& VD" } },
        { name: { contains: ", (no" } },
        { name: { contains: "NTC, (no" } },
        { name: { contains: "SEBC, (no" } },
        { name: { contains: "OPEN, (no" } },
        { name: { startsWith: "MEDICINE " } },
        { slug: { startsWith: "tb-" } },
        { slug: { startsWith: "critical-" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${badColleges.length} malformed colleges to remove`);

  for (const c of badColleges) {
    await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
    await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
    await prisma.college.delete({ where: { id: c.id } });
    console.log(`  ✓ Removed: ${c.name}`);
  }

  const remaining = await prisma.college.count({
    where: { OR: [{ name: { startsWith: "&" } }, { name: { contains: "& TB" } }] },
  });
  console.log(`\n✅ Cleanup done. Remaining bad colleges: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
