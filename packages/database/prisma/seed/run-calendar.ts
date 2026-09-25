/** Refresh NEET-PG 2026 counselling calendar only */
import { PrismaClient } from "@prisma/client";
import { seedCalendar } from "./calendar.js";

const prisma = new PrismaClient();

async function main() {
  const aiq = await prisma.counselling.findUnique({ where: { code: "AIQ" } });
  const maharashtra = await prisma.counselling.findUnique({ where: { code: "MAHARASHTRA" } });
  if (!aiq) throw new Error("AIQ counselling not found — run full seed first");

  await seedCalendar(prisma, { aiq, maharashtra: maharashtra ?? undefined });
  console.log("✅ Calendar updated");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
