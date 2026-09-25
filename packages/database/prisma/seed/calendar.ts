import { PrismaClient } from "@prisma/client";
import {
  NEET_PG_2026_ALL_EVENTS,
  NEET_PG_2026_SESSION,
} from "../../../types/src/counselling-calendar-2026.js";

export async function seedCalendar(
  prisma: PrismaClient,
  counsellings: { aiq: { id: string }; maharashtra?: { id: string } }
) {
  async function ensureSource(authority: string, title: string, url: string) {
    const existing = await prisma.source.findFirst({ where: { url } });
    if (existing) {
      return prisma.source.update({
        where: { id: existing.id },
        data: { lastVerifiedDate: new Date(), dataYear: 2026 },
      });
    }
    return prisma.source.create({
      data: {
        authority,
        title,
        url,
        publishedDate: new Date(`${NEET_PG_2026_SESSION.lastUpdated}T00:00:00`),
        lastVerifiedDate: new Date(),
        dataYear: 2026,
        sourceType: "OFFICIAL",
        trustLevel: "PRIMARY",
      },
    });
  }

  const mccSource = await ensureSource(
    "MCC",
    "MCC NEET-PG 2026 Counselling Schedule",
    NEET_PG_2026_SESSION.mccSchedule
  );

  const mahSource = await ensureSource(
    "MAHACET",
    "Maharashtra State CET Cell — NEET-PG CAP 2026-27",
    NEET_PG_2026_SESSION.maharashtraPortal
  );

  const codeToId: Record<string, string> = {
    AIQ: counsellings.aiq.id,
    MAHARASHTRA: counsellings.maharashtra?.id ?? counsellings.aiq.id,
  };

  await prisma.calendarEvent.deleteMany({});

  for (const e of NEET_PG_2026_ALL_EVENTS) {
    const counsellingId = codeToId[e.counsellingCode];
    const sourceId = e.counsellingCode === "MAHARASHTRA" ? mahSource.id : mccSource.id;
    const statusNote = e.status === "expected" ? " (Expected — verify on official portal)" : "";

    await prisma.calendarEvent.create({
      data: {
        counsellingId,
        eventType: e.eventType,
        title: `${e.title}${statusNote}`,
        startAt: new Date(`${e.startAt}T09:00:00+05:30`),
        endAt: e.endAt ? new Date(`${e.endAt}T23:59:59+05:30`) : undefined,
        sourceId,
      },
    });
  }

  console.log(`  ${NEET_PG_2026_ALL_EVENTS.length} NEET-PG 2026-27 calendar events (MCC + Maharashtra)`);
}
