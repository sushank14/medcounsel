/** NEET-PG 2026-27 counselling calendar — update when MCC / MAHACET publish official notices */

export type CounsellingEventStatus = "official" | "expected";

export type CounsellingCalendarEvent = {
  counsellingCode: "AIQ" | "MAHARASHTRA";
  eventType: "REGISTRATION" | "CHOICE_FILL" | "LOCK" | "RESULT" | "REPORTING" | "RESIGNATION";
  title: string;
  startAt: string;
  endAt?: string;
  status: CounsellingEventStatus;
  round?: "R1" | "R2" | "R3" | "STRAY";
};

export type CounsellingNewsItem = {
  date: string;
  title: string;
  summary: string;
  tag: "result" | "mcc" | "maharashtra" | "cutoff" | "general";
  url?: string;
};

export const NEET_PG_2026_SESSION = {
  academicYear: "2026-27",
  examDate: "2026-08-30",
  resultDate: "2026-09-24",
  mccPortal: "https://mcc.nic.in/pg-medical-counselling/",
  mccSchedule: "https://mcc.nic.in/eservices-schedule-pg/",
  maharashtraPortal: "https://cetcell.mahacet.org/",
  maharashtraPgPortal: "https://medicalpg2026.mahacet.org/",
  lastUpdated: "2026-09-25",
} as const;

/** MCC AIQ + Deemed + Central — expected timeline after Sep 2026 result */
export const MCC_NEET_PG_2026_EVENTS: CounsellingCalendarEvent[] = [
  {
    counsellingCode: "AIQ",
    eventType: "REGISTRATION",
    title: "MCC NEET-PG 2026 AIQ — Registration & fee payment",
    startAt: "2026-10-15",
    endAt: "2026-10-25",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 1 — Choice filling",
    startAt: "2026-10-27",
    endAt: "2026-10-31",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "LOCK",
    title: "MCC AIQ Round 1 — Choice locking",
    startAt: "2026-10-31",
    endAt: "2026-10-31",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 1 — Seat allotment result",
    startAt: "2026-11-06",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 1 — Reporting to allotted college",
    startAt: "2026-11-07",
    endAt: "2026-11-20",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 2 — Choice filling",
    startAt: "2026-11-28",
    endAt: "2026-12-02",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 2 — Seat allotment result",
    startAt: "2026-12-05",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 2 — Reporting to allotted college",
    startAt: "2026-12-06",
    endAt: "2026-12-15",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 3 — Choice filling",
    startAt: "2027-01-05",
    endAt: "2027-01-09",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 3 — Seat allotment result",
    startAt: "2027-01-15",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 3 — Reporting to allotted college",
    startAt: "2027-01-16",
    endAt: "2027-01-25",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Stray Vacancy Round — Choice filling",
    startAt: "2027-02-01",
    endAt: "2027-02-08",
    status: "expected",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Stray Vacancy Round — Allotment result",
    startAt: "2027-02-10",
    status: "expected",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Stray Vacancy Round — Reporting",
    startAt: "2027-02-11",
    endAt: "2027-02-18",
    status: "expected",
    round: "STRAY",
  },
];

/** Maharashtra state CAP — typically starts after MCC Round 1 */
export const MAHARASHTRA_NEET_PG_2026_EVENTS: CounsellingCalendarEvent[] = [
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REGISTRATION",
    title: "Maharashtra CAP — Information brochure & registration open",
    startAt: "2026-10-20",
    endAt: "2026-10-30",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP — Provisional state merit list",
    startAt: "2026-11-05",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 1 — Preference / choice filling",
    startAt: "2026-11-08",
    endAt: "2026-11-12",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 1 — Selection list",
    startAt: "2026-11-15",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 1 — Reporting & status retention form",
    startAt: "2026-11-16",
    endAt: "2026-11-28",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 2 — Choice filling",
    startAt: "2026-12-10",
    endAt: "2026-12-14",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 2 — Selection list",
    startAt: "2026-12-17",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 2 — Reporting",
    startAt: "2026-12-18",
    endAt: "2026-12-28",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 3 / Mop-up — Choice filling",
    startAt: "2027-01-10",
    endAt: "2027-01-14",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 3 — Selection list",
    startAt: "2027-01-18",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 3 — Reporting",
    startAt: "2027-01-19",
    endAt: "2027-01-28",
    status: "expected",
    round: "R3",
  },
];

export const NEET_PG_2026_ALL_EVENTS: CounsellingCalendarEvent[] = [
  ...MCC_NEET_PG_2026_EVENTS,
  ...MAHARASHTRA_NEET_PG_2026_EVENTS,
];

export const NEET_PG_2026_NEWS: CounsellingNewsItem[] = [
  {
    date: "2026-09-24",
    title: "NEET-PG 2026 result declared",
    summary:
      "NBEMS released NEET-PG 2026 results. Qualified candidates can prepare documents for MCC AIQ and state counselling registration.",
    tag: "result",
    url: "https://natboard.edu.in/",
  },
  {
    date: "2026-09-25",
    title: "MCC AIQ counselling schedule awaited",
    summary:
      "MCC has not yet published the PG counselling PDF on mcc.nic.in. Registration is widely expected in the third week of October 2026 — watch the official portal daily.",
    tag: "mcc",
    url: NEET_PG_2026_SESSION.mccSchedule,
  },
  {
    date: "2026-09-25",
    title: "Maharashtra CAP 2026-27 dates TBA",
    summary:
      "State CET Cell Maharashtra will announce CAP brochure, registration fee (₹3,000), and round-wise dates on mahacet.org after the AIQ timeline is clearer.",
    tag: "maharashtra",
    url: NEET_PG_2026_SESSION.maharashtraPortal,
  },
  {
    date: "2026-09-25",
    title: "Cutoff data on MedCounsel",
    summary:
      "Historical MCC AIQ and Maharashtra SML cutoffs (2020–2025) are live. Use My Chances and College Search while waiting for 2026 allotment rounds.",
    tag: "cutoff",
  },
];
