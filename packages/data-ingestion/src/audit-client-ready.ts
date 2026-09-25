/**
 * Pre-client audit — run: npx tsx src/audit-client-ready.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  qualifiesAsGovernmentCollege,
  hasPrivateOwnershipSignals,
} from "../../types/src/college-type.js";

const prisma = new PrismaClient();
const issues: string[] = [];

function issue(msg: string) {
  issues.push(msg);
}

async function main() {
  console.log("🔍 Client-readiness audit\n");

  // 1. Demo data
  const demos = await prisma.college.count({
    where: { OR: [{ slug: { startsWith: "demo-" } }, { dataStatus: "DEMO" }] },
  });
  if (demos > 0) issue(`${demos} demo/placeholder colleges still in DB`);

  // 2. GOVT tag with private names
  const govtPrivateName = await prisma.college.count({
    where: {
      collegeType: "GOVT",
      OR: [
        { name: { contains: "Private" } },
        { name: { contains: "Pvt" } },
        { name: { contains: "unit of" } },
      ],
    },
  });
  if (govtPrivateName > 0) issue(`${govtPrivateName} GOVT colleges still have Private/Pvt in name`);

  // 3. GOVT/CENTRAL that fail strict government check
  const govtColleges = await prisma.college.findMany({
    where: { collegeType: { in: ["GOVT", "CENTRAL"] }, dataStatus: "OFFICIAL" },
    select: { name: true, collegeType: true },
  });
  const falseGovt = govtColleges.filter(
    (c) => hasPrivateOwnershipSignals(c.name) && !qualifiesAsGovernmentCollege(c.name, c.collegeType)
  );
  if (falseGovt.length > 0) {
    issue(`${falseGovt.length} GOVT/CENTRAL colleges have private ownership signals`);
    falseGovt.slice(0, 5).forEach((c) => issue(`  e.g. ${c.name.slice(0, 65)}`));
  }

  // 4. Suspicious multi-specialty hospital tagged GOVT
  const suspicious = await prisma.college.findMany({
    where: {
      collegeType: "GOVT",
      name: { contains: "Multispeciality Hospital" },
    },
    select: { name: true },
    take: 5,
  });
  if (suspicious.length > 0) {
    issue(`${suspicious.length}+ GOVT-tagged multispeciality hospitals (review)`);
  }

  // 5. Unknown cities on colleges with cutoffs
  const unknownCityRow = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT c.id) as n FROM College c
    INNER JOIN Cutoff co ON co.collegeId = c.id
    WHERE c.city IS NULL OR c.city = '' OR c.city = 'Unknown'
  `;
  const unknownCityWithCutoffs = Number(unknownCityRow[0]?.n ?? 0);
  if (unknownCityWithCutoffs > 20) {
    issue(`${unknownCityWithCutoffs} colleges with cutoffs still have Unknown/empty city`);
  }

  // 6. Orphan cutoffs
  const orphans = await prisma.cutoff.count({
    where: { NOT: { college: { id: { not: undefined } } } },
  });
  // simpler check
  const orphanCheck = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) as n FROM Cutoff c
    WHERE NOT EXISTS (SELECT 1 FROM College col WHERE col.id = c.collegeId)
  `;
  if (Number(orphanCheck[0]?.n ?? 0) > 0) issue("Orphan cutoffs without college");

  // 7. Calendar
  const cal = await prisma.calendarEvent.count();
  if (cal < 20) issue(`Only ${cal} calendar events (expected ~25 for NEET-PG 2026)`);

  // 8. Auth users
  const users = await prisma.user.count();
  if (users === 0) issue("No users in database — login will fail");

  // 9. Zero-cutoff official colleges with specialties
  const zeroCutoff = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) as n FROM College c
    WHERE c.dataStatus = 'OFFICIAL'
      AND EXISTS (SELECT 1 FROM CollegeSpecialty cs WHERE cs.collegeId = c.id)
      AND NOT EXISTS (SELECT 1 FROM Cutoff co WHERE co.collegeId = c.id)
  `;
  const zc = Number(zeroCutoff[0]?.n ?? 0);
  if (zc > 300) issue(`${zc} official colleges have specialties but zero cutoffs (data gap, not crash)`);

  // 10. Generic GMC duplicates
  const genericGmc = await prisma.college.count({
    where: {
      name: { in: ["Government Medical College", "Govt. Medical College", "Govt. Medical College and Hospital"] },
      cutoffs: { none: {} },
    },
  });
  if (genericGmc > 0) issue(`${genericGmc} empty generic GMC name duplicates without cutoffs`);

  console.log(issues.length === 0 ? "✅ No blocking issues found\n" : `⚠️  ${issues.length} issue(s):\n`);
  issues.forEach((i) => console.log(`  • ${i}`));

  console.log("\n📊 Summary");
  const stats = {
    colleges: await prisma.college.count({ where: { dataStatus: "OFFICIAL" } }),
    cutoffs: await prisma.cutoff.count(),
    calendar: cal,
    users,
  };
  console.log(`  Official colleges: ${stats.colleges}`);
  console.log(`  Cutoffs: ${stats.cutoffs.toLocaleString()}`);
  console.log(`  Calendar events: ${stats.calendar}`);
  console.log(`  Users: ${stats.users}`);

  if (issues.some((i) => !i.includes("data gap"))) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
