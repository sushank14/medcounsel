export type FitLevel = "STRONG" | "POSSIBLE" | "BORDERLINE" | "DIFFICULT";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type RankType = "AIR" | "SML" | "STATE_MERIT";

export interface CutoffRecord {
  year: number;
  round: string;
  closingRank: number;
  openingRank?: number | null;
  category: string;
  quota: string;
}

export interface RankStatistics {
  median: number;
  mean: number;
  min: number;
  max: number;
  stddev: number;
  dataYears: number;
}

export interface YearWiseCutoff {
  year: number;
  closingRank: number;
  round: string;
}

export interface YearTrendSummary {
  years: number[];
  byYear: Record<number, number>;
  trend: "TIGHTENING" | "RELAXING" | "STABLE" | "INSUFFICIENT_DATA";
  trendDescription: string;
  projectedRange?: { min: number; max: number };
}

export const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General (Unreserved)",
  EWS: "EWS",
  OBC: "OBC (Non-Creamy Layer)",
  SC: "SC",
  ST: "ST",
  PWD: "PwD",
};

export const QUOTA_LABELS: Record<string, string> = {
  AIQ: "All India Quota (50%)",
  STATE: "State Quota",
  MANAGEMENT: "Management Quota",
  NRI: "NRI Quota",
  IQ: "Institutional Quota",
  IN_SERVICE: "In-Service Quota",
};

export interface PredictionInput {
  rank: number;
  rankType: RankType;
  category: string;
  domicileState: string;
  counsellingPref: "AIQ" | "STATE" | "BOTH";
  preferredSpecialties?: string[];
  collegePref?: string;
  budgetRange?: string;
  stateFilter?: string;
  cityFilter?: string;
  preferredCities?: string[];
  collegeTypeFilter?: string[];
  degreeFilter?: DegreeFilter;
  priorityRanking?: string[];
}

export type DegreeFilter = "ALL" | "MD" | "MS" | "DNB";

export const DEGREE_OPTIONS: { value: DegreeFilter; label: string }[] = [
  { value: "ALL", label: "All (MD + MS + DNB)" },
  { value: "MD", label: "MD only" },
  { value: "MS", label: "MS only" },
  { value: "DNB", label: "DNB only (NBEMS hospitals)" },
];

export const DEGREE_LABELS: Record<string, string> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "Diploma",
  DM: "DM",
  MCH: "MCh",
};

/** Priorities that actually affect result sorting in the prediction engine */
export const CORE_PRIORITIES = [
  "Branch",
  "Location",
  "Government college",
  "Fees",
  "Stipend",
  "Bond",
] as const;

export const DEFAULT_PRIORITIES = CORE_PRIORITIES;

export function normalizePriorities(saved?: string[]): string[] {
  const allowed = new Set<string>(CORE_PRIORITIES);
  if (!saved?.length) return [...CORE_PRIORITIES];
  const ordered = saved.filter((p) => allowed.has(p));
  for (const p of CORE_PRIORITIES) {
    if (!ordered.includes(p)) ordered.push(p);
  }
  return ordered;
}

export interface PredictionResult {
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  collegeType: string;
  state: string;
  city: string;
  specialtyId: string;
  specialtyName: string;
  degree: string;
  counsellingCode: string;
  counsellingName: string;
  category: string;
  quota: string;
  candidateRank: number;
  rankType: RankType;
  historicalCutoffs: CutoffRecord[];
  yearWiseCutoffs: YearWiseCutoff[];
  yearTrend: YearTrendSummary;
  statistics: RankStatistics;
  candidateDiff: number;
  fitLevel: FitLevel;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  fees?: { totalAnnual: number; tuitionFee: number; hostelFee: number; isEstimate?: boolean };
  bond?: { durationYears?: number | null; bondAmount?: number | null; serviceObligation?: string | null };
  stipend?: { totalMonthly: number; yearOfTraining: string; payScale?: string | null };
  roundMovement: { round: string; closingRank: number; year: number }[];
  seatCount?: number;
  sourceUrl?: string;
  sourceTitle?: string;
  dataStatus: string;
  disclaimer: string;
}

export interface SimulatorInput extends PredictionInput {
  rankOverride?: number;
  categoryOverride?: string;
  budgetOverride?: string;
  collegePrefOverride?: string;
  stateOverride?: string;
  removeSpecialties?: string[];
}

export const FIT_LABELS: Record<FitLevel, { label: string; color: string; emoji: string }> = {
  STRONG: { label: "Strong possibility", color: "text-emerald-700 bg-emerald-50 border-emerald-200", emoji: "🟢" },
  POSSIBLE: { label: "Possible / competitive", color: "text-amber-700 bg-amber-50 border-amber-200", emoji: "🟡" },
  BORDERLINE: { label: "Borderline", color: "text-orange-700 bg-orange-50 border-orange-200", emoji: "🟠" },
  DIFFICULT: { label: "Historically difficult", color: "text-red-700 bg-red-50 border-red-200", emoji: "🔴" },
};

export const ACTIVE_SEAT_MATRIX_YEAR = 2026;
export const ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR = "2026-27";

export const SEAT_MATRIX_SOURCE_NOTE =
  "Seat data sourced from the National Medical Commission (NMC/MARB) PG Seat Matrix for Academic Year 2026–27, dated 29 September 2026. The matrix is subject to subsequent revisions by NMC/MARB.";

export const DISCLAIMER =
  "Predictions are estimates based on historical and available counselling data and do not guarantee admission. Verify eligibility, fees, deadlines, and rules with the official counselling authority.";

export const DISCLAIMER_WITH_SEATS = `${DISCLAIMER} ${SEAT_MATRIX_SOURCE_NOTE}`;

/** Major Maharashtra cities/districts for location preference (matches messy college address data) */
export const MAHARASHTRA_CITIES = [
  "Mumbai",
  "Pune",
  "Nagpur",
  "Navi Mumbai",
  "Thane",
  "Nashik",
  "Aurangabad",
  "Kolhapur",
  "Solapur",
  "Amravati",
  "Latur",
  "Akola",
  "Jalgaon",
  "Dhule",
  "Sangli",
  "Ahmednagar",
  "Chandrapur",
  "Nanded",
  "Gondia",
  "Ratnagiri",
] as const;

const CITY_MATCH_ALIASES: Record<string, string[]> = {
  Mumbai: ["mumbai", "mumb", "parel", "andheri", "bandra", "kurla", "borivali", "mazagaon"],
  "Navi Mumbai": ["navi mumbai", "new mumbai"],
  Thane: ["thane"],
  Pune: ["pune", "erandawane", "koregaon"],
  Nagpur: ["nagpur"],
  Nashik: ["nashik", "nasik"],
  Aurangabad: ["aurangabad", "auranagabad"],
  Kolhapur: ["kolhapur"],
  Solapur: ["solapur"],
  Amravati: ["amravati"],
  Latur: ["latur"],
  Akola: ["akola"],
  Jalgaon: ["jalgaon"],
  Dhule: ["dhule"],
  Sangli: ["sangli", "miraj"],
  Ahmednagar: ["ahmednagar"],
  Chandrapur: ["chandrapur"],
  Nanded: ["nanded"],
  Gondia: ["gondia"],
  Ratnagiri: ["ratnagiri"],
};

export function matchesPreferredCity(collegeCity: string, preferredCity: string): boolean {
  const haystack = collegeCity.toLowerCase().replace(/[.,]/g, " ").trim();
  const needles = CITY_MATCH_ALIASES[preferredCity] ?? [preferredCity.toLowerCase()];
  return needles.some((n) => haystack.includes(n));
}

export function matchesAnyPreferredCity(collegeCity: string, preferredCities?: string[]): boolean {
  if (!preferredCities?.length) return false;
  return preferredCities.some((city) => matchesPreferredCity(collegeCity, city));
}

export function normalizePreferredCities(saved?: string[]): string[] {
  const allowed = new Set<string>(MAHARASHTRA_CITIES);
  if (!saved?.length) return [];
  return saved.filter((c) => allowed.has(c));
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

export * from "./top-colleges";
export * from "./college-display";
export * from "./college-type";
export * from "./counselling-calendar-2026";

export const SPECIALTY_OPTIONS = [
  "MD General Medicine",
  "MD Pediatrics",
  "MD Radiodiagnosis",
  "MD Dermatology",
  "MD Psychiatry",
  "MD Anaesthesiology",
  "MD Pathology",
  "MD Radiotherapy",
  "MD Emergency Medicine",
  "MD Respiratory Medicine",
  "MS Orthopedics",
  "MS General Surgery",
  "MS Obstetrics & Gynecology",
  "MS Ophthalmology",
  "MS ENT",
  "DNB General Medicine",
  "DNB Pediatrics",
  "DNB Radiodiagnosis",
  "DNB Anaesthesiology",
  "DNB Obstetrics & Gynecology",
  "DNB General Surgery",
  "DNB Orthopedics",
  "DNB ENT",
  "DNB Ophthalmology",
  "DNB Emergency Medicine",
  "DNB Respiratory Medicine",
];

export function specialtiesForDegree(degree: DegreeFilter): string[] {
  if (degree === "ALL") return SPECIALTY_OPTIONS;
  return SPECIALTY_OPTIONS.filter((s) => s.startsWith(`${degree} `));
}
