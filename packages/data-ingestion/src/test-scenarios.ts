import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("🧪 MedCounsel scenario tests\n");

  // 1. No malformed college names
  const badColleges = await prisma.college.count({
    where: { OR: [{ name: { startsWith: "&" } }, { name: { contains: "& TB" } }, { name: { contains: "& CRITICAL" } }] },
  });
  badColleges === 0 ? ok("No & prefix college names") : fail("No & prefix college names", `${badColleges} found`);

  // 2. AIQ cutoffs exist
  const aiq = await prisma.cutoff.count({ where: { counselling: { code: "AIQ" }, verificationStatus: "VERIFIED" } });
  aiq > 40000 ? ok(`AIQ cutoffs loaded (${aiq.toLocaleString()})`) : fail("AIQ cutoffs", `${aiq}`);

  // 3. Maharashtra SML cutoffs exist
  const mah = await prisma.cutoff.count({ where: { counselling: { code: "MAHARASHTRA" }, verificationStatus: "VERIFIED", rankType: "SML" } });
  mah > 1000 ? ok(`Maharashtra SML cutoffs (${mah.toLocaleString()})`) : fail("Maharashtra cutoffs", `${mah}`);

  // 4. College search — Grant Medical
  const grant = await prisma.college.findFirst({ where: { name: { contains: "Grant Medical" } } });
  grant ? ok(`College search: Grant Medical (${grant.city})`) : fail("College search: Grant Medical");

  // 5. College search — Maharashtra state filter
  const mahColleges = await prisma.college.count({ where: { state: "Maharashtra", dataStatus: "OFFICIAL" } });
  mahColleges > 20 ? ok(`Maharashtra colleges (${mahColleges})`) : fail("Maharashtra colleges", `${mahColleges}`);

  // 6. Cutoff filter AIQ GENERAL 2025
  const aiqGen = await prisma.cutoff.count({
    where: { counselling: { code: "AIQ" }, category: "GENERAL", year: 2025, verificationStatus: "VERIFIED" },
  });
  aiqGen > 100 ? ok(`AIQ GENERAL 2025 cutoffs (${aiqGen})`) : fail("AIQ GENERAL 2025", `${aiqGen}`);

  // 7. Cutoff filter Maharashtra OBC SML
  const mahObc = await prisma.cutoff.count({
    where: { counselling: { code: "MAHARASHTRA" }, category: "OBC", rankType: "SML" },
  });
  mahObc > 50 ? ok(`Maharashtra OBC SML cutoffs (${mahObc})`) : fail("Maharashtra OBC SML", `${mahObc}`);

  // 8. Rank type never mixed — AIQ should be AIR only
  const aiqSml = await prisma.cutoff.count({ where: { counselling: { code: "AIQ" }, rankType: "SML" } });
  aiqSml === 0 ? ok("AIQ uses AIR ranks only") : fail("AIQ rank type mix", `${aiqSml} SML in AIQ`);

  // 9. Maharashtra uses SML only
  const mahAir = await prisma.cutoff.count({ where: { counselling: { code: "MAHARASHTRA" }, rankType: "AIR" } });
  mahAir === 0 ? ok("Maharashtra uses SML ranks only") : fail("Maharashtra rank type mix", `${mahAir} AIR in MAH`);

  // 10. Chest & TB → Respiratory Medicine (not & TB college)
  const resp = await prisma.cutoff.findFirst({
    where: {
      counselling: { code: "MAHARASHTRA" },
      specialty: { name: { contains: "Respiratory" } },
      college: { name: { contains: "Grant" } },
    },
    include: { college: true, specialty: true },
  });
  resp ? ok(`CHEST & TB → ${resp.specialty.name} at ${resp.college.name.split(",")[0]}`) : fail("CHEST & TB parsing");

  // 11. Emergency & Critical → Emergency Medicine at BJMC
  const emerg = await prisma.cutoff.findFirst({
    where: {
      counselling: { code: "MAHARASHTRA" },
      specialty: { name: { contains: "Emergency" } },
      college: { name: { contains: "BJ Medical" } },
    },
    include: { college: true, specialty: true },
  });
  emerg ? ok(`EMERGENCY & CRITICAL → ${emerg.specialty.name} at BJMC`) : fail("EMERGENCY & CRITICAL parsing");

  // 12. Skin & VD → Dermatology
  const derm = await prisma.cutoff.findFirst({
    where: {
      counselling: { code: "MAHARASHTRA" },
      specialty: { name: "Dermatology" },
      college: { name: { contains: "Grant" } },
    },
  });
  derm ? ok("SKIN & VD → Dermatology at GSMC") : fail("SKIN & VD parsing");

  // 13. Demo users exist
  const demo = await prisma.user.findUnique({ where: { email: "demo@medcounsel.demo" } });
  demo ? ok("Demo user exists") : fail("Demo user missing");

  // 14. Profile exists for demo user
  const profile = await prisma.candidateProfile.findFirst({ where: { userId: demo?.id, isActive: true } });
  profile ? ok(`Demo profile: rank ${profile.rank} ${profile.rankType}, ${profile.domicileState}`) : fail("Demo profile missing");

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
