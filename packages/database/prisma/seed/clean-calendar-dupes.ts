import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const events = await prisma.calendarEvent.findMany({ orderBy: { startAt: "asc" } });
  const seen = new Set<string>();
  let removed = 0;

  for (const e of events) {
    const key = `${e.title}|${e.startAt.toISOString().slice(0, 10)}|${e.counsellingId}`;
    if (seen.has(key)) {
      await prisma.calendarEvent.delete({ where: { id: e.id } });
      removed++;
    } else {
      seen.add(key);
    }
  }

  console.log(`Removed ${removed} duplicate calendar events`);
  await prisma.$disconnect();
}

main().catch(console.error);
