import {
  NEET_PG_2026_ALL_EVENTS,
  type CounsellingCalendarEvent,
} from "@medcounsel/types";
import { eventPhase, formatEventRange } from "./counselling-calendar";

export type NextAction = {
  priority: number;
  title: string;
  description: string;
  href?: string;
  phase: "urgent" | "upcoming" | "info";
  source: "official" | "expected";
};

export type TrackStatus = {
  code: "AIQ" | "MAHARASHTRA";
  label: string;
  currentRound?: string;
  activeEvent?: CounsellingCalendarEvent;
  nextEvent?: CounsellingCalendarEvent;
  phase: "past" | "active" | "upcoming" | "not_started";
};

function trackEvents(code: "AIQ" | "MAHARASHTRA", now = new Date()) {
  const events = NEET_PG_2026_ALL_EVENTS.filter((e) => e.counsellingCode === code).sort((a, b) =>
    a.startAt.localeCompare(b.startAt)
  );
  const active = events.find((e) => eventPhase(e.startAt, e.endAt, now) === "active");
  const upcoming = events.find((e) => eventPhase(e.startAt, e.endAt, now) === "upcoming");
  const allPast = events.every((e) => eventPhase(e.startAt, e.endAt, now) === "past");
  return {
    events,
    active,
    upcoming,
    phase: active ? ("active" as const) : allPast ? ("past" as const) : upcoming ? ("upcoming" as const) : ("not_started" as const),
    currentRound: active?.round ?? upcoming?.round,
  };
}

export function getTrackStatuses(now = new Date()): TrackStatus[] {
  return (["AIQ", "MAHARASHTRA"] as const).map((code) => {
    const t = trackEvents(code, now);
    return {
      code,
      label: code === "AIQ" ? "MCC AIQ" : "Maharashtra CAP",
      currentRound: t.currentRound,
      activeEvent: t.active,
      nextEvent: t.upcoming,
      phase: t.phase,
    };
  });
}

export function getNextActions(input: {
  hasProfile: boolean;
  counsellingPref: string;
  domicileState: string;
  choiceListCount: number;
  now?: Date;
}): NextAction[] {
  const now = input.now ?? new Date();
  const actions: NextAction[] = [];

  if (!input.hasProfile) {
    actions.push({
      priority: 1,
      title: "Complete your counselling profile",
      description: "Add rank, category, domicile, and branch preferences so predictions and choice lists are personalised.",
      href: "/onboarding",
      phase: "urgent",
      source: "official",
    });
    return actions;
  }

  const aiq = trackEvents("AIQ", now);
  const mh =
    input.domicileState === "Maharashtra" || input.counsellingPref === "STATE" || input.counsellingPref === "BOTH"
      ? trackEvents("MAHARASHTRA", now)
      : null;

  if (aiq.active) {
    actions.push({
      priority: 1,
      title: aiq.active.title,
      description: `Active now (${formatEventRange(aiq.active.startAt, aiq.active.endAt)}). Complete this on the MCC portal before the deadline.`,
      href: "/counselling",
      phase: "urgent",
      source: aiq.active.status,
    });
  }

  if (mh?.active) {
    actions.push({
      priority: 2,
      title: mh.active.title,
      description: `Maharashtra CAP — active now (${formatEventRange(mh.active.startAt, mh.active.endAt)}).`,
      href: "/counselling",
      phase: "urgent",
      source: mh.active.status,
    });
  }

  if (input.choiceListCount === 0) {
    actions.push({
      priority: 3,
      title: "Start your choice list",
      description: "Research options in My Chances, then add colleges to your preference list in priority order.",
      href: "/my-chances",
      phase: "upcoming",
      source: "official",
    });
  } else if (input.choiceListCount < 5) {
    actions.push({
      priority: 4,
      title: "Expand your choice list",
      description: `You have ${input.choiceListCount} choice${input.choiceListCount === 1 ? "" : "s"}. Most candidates fill 20–50 options across dream, target, and backup tiers.`,
      href: "/preferences",
      phase: "info",
      source: "official",
    });
  }

  if (aiq.upcoming && !aiq.active) {
    actions.push({
      priority: 5,
      title: `Upcoming: ${aiq.upcoming.title}`,
      description: formatEventRange(aiq.upcoming.startAt, aiq.upcoming.endAt),
      href: "/calendar",
      phase: "upcoming",
      source: aiq.upcoming.status,
    });
  }

  actions.push({
    priority: 10,
    title: "Review required documents",
    description: "Tick off registration documents before counselling registration opens.",
    href: "/documents",
    phase: "info",
    source: "official",
  });

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

export function upcomingDeadlines(limit = 5, now = new Date()) {
  return NEET_PG_2026_ALL_EVENTS.filter((e) => eventPhase(e.startAt, e.endAt, now) !== "past")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, limit)
    .map((e) => ({
      ...e,
      phase: eventPhase(e.startAt, e.endAt, now),
      dateLabel: formatEventRange(e.startAt, e.endAt),
    }));
}
