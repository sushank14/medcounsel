/**
 * Re-tag misclassified colleges (private DNB hospitals stored as GOVT, etc.).
 * Run: npm run fix-college-types --workspace=@medcounsel/data-ingestion
 */
import { PrismaClient } from "@prisma/client";
import { confidentCollegeTypeRetag } from "../../types/src/college-type.js";

const prisma = new PrismaClient();

async function main() {
  const colleges = await prisma.college.findMany({
    where: { dataStatus: "OFFICIAL", NOT: { slug: { startsWith: "demo-" } } },
    select: { id: true, name: true, collegeType: true },
  });

  let updated = 0;
  const changes: { name: string; from: string; to: string }[] = [];

  for (const c of colleges) {
    const inferred = confidentCollegeTypeRetag(c.name, c.collegeType);
    if (!inferred || inferred === c.collegeType) continue;

    await prisma.college.update({
      where: { id: c.id },
      data: { collegeType: inferred },
    });
    changes.push({ name: c.name.slice(0, 70), from: c.collegeType, to: inferred });
    updated++;
  }

  console.log(`✅ Updated ${updated} college type tags`);
  for (const ch of changes.slice(0, 30)) {
    console.log(`  ${ch.from} → ${ch.to}: ${ch.name}`);
  }
  if (changes.length > 30) console.log(`  … and ${changes.length - 30} more`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
