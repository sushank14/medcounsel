import { PrismaClient } from "@prisma/client";
import { seedCounsellings } from "./counsellings";
import { seedSpecialties } from "./specialties";
import { seedCalendar } from "./calendar";
import { seedAdminUser } from "./admin";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding MedCounsel AI (core config only — no demo colleges)...");

  await seedAdminUser(prisma);
  const counsellings = await seedCounsellings(prisma);
  await seedSpecialties(prisma);
  await seedCalendar(prisma, counsellings);

  console.log("✅ Seed complete — import MCC/Maharashtra data for colleges & cutoffs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
