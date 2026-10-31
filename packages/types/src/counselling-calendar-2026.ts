/** NEET-PG 2026-27 counselling calendar — MCC dates from DGHS tentative schedule (07 Oct 2026) */

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
  /** PG academic session commencement per MCC schedule */
  academicSessionStart: "2026-11-20",
  mccPortal: "https://mcc.nic.in/pg-medical-counselling/",
  mccSchedule: "https://mcc.nic.in/eservices-schedule-pg/",
  /** DGHS tentative allotment schedule PDF (07 Oct 2026) */
  mccSchedulePdf:
    "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610071411981089.pdf",
  maharashtraPortal: "https://cetcell.mahacet.org/",
  maharashtraPgPortal: "https://medicalpg2026.mahacet.org/",
  lastUpdated: "2026-10-07",
} as const;

/**
 * MCC AIQ + Deemed + Central + AFMS — official tentative schedule
 * Source: DGHS File No. U-12021/09/2026-MEC (07 Oct 2026)
 */
export const MCC_NEET_PG_2026_EVENTS: CounsellingCalendarEvent[] = [
  {
    counsellingCode: "AIQ",
    eventType: "REGISTRATION",
    title: "MCC AIQ Round 1 — Registration & fee payment (closes 12:00 noon 21 Oct; payment until 3 PM)",
    startAt: "2026-10-12",
    endAt: "2026-10-21",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 1 — Choice filling (until 10:00 AM 22 Oct)",
    startAt: "2026-10-13",
    endAt: "2026-10-22",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "LOCK",
    title: "MCC AIQ Round 1 — Choice locking (4 PM 21 Oct – 10 AM 22 Oct)",
    startAt: "2026-10-21",
    endAt: "2026-10-22",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 1 — Seat allotment result",
    startAt: "2026-10-24",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 1 — Reporting / joining at allotted college",
    startAt: "2026-10-26",
    endAt: "2026-11-02",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REGISTRATION",
    title: "MCC AIQ Round 2 — Registration & fee payment (closes 12:00 noon 11 Nov; payment until 3 PM)",
    startAt: "2026-11-06",
    endAt: "2026-11-11",
    status: "official",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 2 — Choice filling (until 10:00 AM 12 Nov)",
    startAt: "2026-11-07",
    endAt: "2026-11-12",
    status: "official",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "LOCK",
    title: "MCC AIQ Round 2 — Choice locking (4 PM 11 Nov – 10 AM 12 Nov)",
    startAt: "2026-11-11",
    endAt: "2026-11-12",
    status: "official",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 2 — Seat allotment result",
    startAt: "2026-11-14",
    status: "official",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 2 — Reporting / joining",
    startAt: "2026-11-16",
    endAt: "2026-11-23",
    status: "official",
    round: "R2",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REGISTRATION",
    title: "MCC AIQ Round 3 — Registration & fee payment (closes 12:00 noon 1 Dec; payment until 3 PM)",
    startAt: "2026-11-26",
    endAt: "2026-12-01",
    status: "official",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Round 3 — Choice filling (until 10:00 AM 2 Dec)",
    startAt: "2026-11-27",
    endAt: "2026-12-02",
    status: "official",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "LOCK",
    title: "MCC AIQ Round 3 — Choice locking (4 PM 1 Dec – 10 AM 2 Dec)",
    startAt: "2026-12-01",
    endAt: "2026-12-02",
    status: "official",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Round 3 — Seat allotment result",
    startAt: "2026-12-04",
    status: "official",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Round 3 — Reporting / joining",
    startAt: "2026-12-05",
    endAt: "2026-12-12",
    status: "official",
    round: "R3",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REGISTRATION",
    title: "MCC AIQ Stray Vacancy Round — Registration & fee payment (closes 12:00 noon 21 Dec; payment until 3 PM)",
    startAt: "2026-12-16",
    endAt: "2026-12-21",
    status: "official",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "CHOICE_FILL",
    title: "MCC AIQ Stray Vacancy Round — Choice filling (until 11:55 PM 21 Dec)",
    startAt: "2026-12-16",
    endAt: "2026-12-21",
    status: "official",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "LOCK",
    title: "MCC AIQ Stray Vacancy Round — Choice locking (4 PM – 11:55 PM 21 Dec)",
    startAt: "2026-12-21",
    endAt: "2026-12-21",
    status: "official",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "RESULT",
    title: "MCC AIQ Stray Vacancy Round — Allotment result",
    startAt: "2026-12-24",
    status: "official",
    round: "STRAY",
  },
  {
    counsellingCode: "AIQ",
    eventType: "REPORTING",
    title: "MCC AIQ Stray Vacancy Round — Reporting / joining",
    startAt: "2026-12-24",
    endAt: "2026-12-31",
    status: "official",
    round: "STRAY",
  },
];

/** Maharashtra state CAP — expected; typically follows MCC Round 1 reporting */
export const MAHARASHTRA_NEET_PG_2026_EVENTS: CounsellingCalendarEvent[] = [
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REGISTRATION",
    title: "Maharashtra CAP — Information brochure & registration open",
    startAt: "2026-11-04",
    endAt: "2026-11-14",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP — Provisional state merit list",
    startAt: "2026-10-30",
    status: "official",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 1 — Preference / choice filling",
    startAt: "2026-11-15",
    endAt: "2026-11-19",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 1 — Selection list",
    startAt: "2026-11-22",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 1 — Reporting & status retention form",
    startAt: "2026-11-23",
    endAt: "2026-12-05",
    status: "expected",
    round: "R1",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 2 — Choice filling",
    startAt: "2026-12-15",
    endAt: "2026-12-19",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 2 — Selection list",
    startAt: "2026-12-22",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 2 — Reporting",
    startAt: "2026-12-23",
    endAt: "2027-01-02",
    status: "expected",
    round: "R2",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "CHOICE_FILL",
    title: "Maharashtra CAP Round 3 / Mop-up — Choice filling",
    startAt: "2027-01-08",
    endAt: "2027-01-12",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "RESULT",
    title: "Maharashtra CAP Round 3 — Selection list",
    startAt: "2027-01-15",
    status: "expected",
    round: "R3",
  },
  {
    counsellingCode: "MAHARASHTRA",
    eventType: "REPORTING",
    title: "Maharashtra CAP Round 3 — Reporting",
    startAt: "2027-01-16",
    endAt: "2027-01-25",
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
    date: "2026-10-30",
    title: "Maharashtra NEET-PG 2026 provisional state merit list",
    summary:
      "MAHACET published the common provisional SML (state merit list). Use Counselling Hub to look up your SML rank by NEET roll number. College cutoffs arrive with the Round 1 selection list.",
    tag: "maharashtra",
    url: "https://medical2026.mahacet.org/NEET-PGM-2026/instructions-downloadFile/merit-pgm-r1.pdf",
  },
  {
    date: "2026-10-07",
    title: "MCC NEET-PG 2026 counselling schedule published",
    summary:
      "DGHS/MCC released the tentative allotment schedule for 50% AIQ and 100% Deemed/Central/AFMS seats. Round 1 registration opens 12 October; choice filling 13–22 October; result 24 October; reporting 26 October–2 November. PG academic session begins 20 November 2026.",
    tag: "mcc",
    url: NEET_PG_2026_SESSION.mccSchedulePdf,
  },
  {
    date: "2026-09-24",
    title: "NEET-PG 2026 result declared",
    summary:
      "NBEMS released NEET-PG 2026 results. Qualified candidates can prepare documents for MCC AIQ and state counselling registration.",
    tag: "result",
    url: "https://natboard.edu.in/",
  },
  {
    date: "2026-10-07",
    title: "Maharashtra CAP 2026-27 dates awaited",
    summary:
      "State CET Cell Maharashtra has not yet published CAP round dates. Expected after MCC Round 1 reporting (by early November) — watch mahacet.org and medicalpg2026.mahacet.org.",
    tag: "maharashtra",
    url: NEET_PG_2026_SESSION.maharashtraPortal,
  },
  {
    date: "2026-10-07",
    title: "Cutoff data on MedCounsel",
    summary:
      "MCC AIQ cutoffs 2020–2025 (final) plus 2026 Round 1 provisional allotment are on MedCounsel — use My Chances and choice list tools for Round 2 planning.",
    tag: "cutoff",
  },
];
