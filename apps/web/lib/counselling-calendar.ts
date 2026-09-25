import {
  NEET_PG_2026_ALL_EVENTS,
  NEET_PG_2026_NEWS,
  NEET_PG_2026_SESSION,
  type CounsellingCalendarEvent,
} from "@medcounsel/types";

export type EventPhase = "past" | "active" | "upcoming";

export function eventPhase(startAt: string, endAt?: string, now = new Date()): EventPhase {
  const start = new Date(`${startAt}T00:00:00+05:30`);
  const end = endAt ? new Date(`${endAt}T23:59:59+05:30`) : start;
  if (now > end) return "past";
  if (now >= start && now <= end) return "active";
  return "upcoming";
}

export function formatEventRange(startAt: string, endAt?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const start = new Date(`${startAt}T00:00:00+05:30`).toLocaleDateString("en-IN", opts);
  if (!endAt || endAt === startAt) return start;
  const end = new Date(`${endAt}T00:00:00+05:30`).toLocaleDateString("en-IN", opts);
  return `${start} – ${end}`;
}

export function upcomingStaticEvents(limit = 6, now = new Date()): CounsellingCalendarEvent[] {
  return NEET_PG_2026_ALL_EVENTS.filter((e) => eventPhase(e.startAt, e.endAt, now) !== "past")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, limit);
}

export function eventsByCounselling(code: "AIQ" | "MAHARASHTRA") {
  return NEET_PG_2026_ALL_EVENTS.filter((e) => e.counsellingCode === code);
}

export { NEET_PG_2026_NEWS, NEET_PG_2026_SESSION, NEET_PG_2026_ALL_EVENTS };
