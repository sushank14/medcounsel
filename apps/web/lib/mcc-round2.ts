import fs from "fs";
import path from "path";

export type VacancyType = "clear" | "virtual" | "new";

export type Round2Record = {
  id: string;
  vacancy_type: VacancyType;
  state: string;
  institute_type: string;
  institute: string;
  institute_name: string;
  institute_code: string;
  institute_code_source?: "printed" | "unique_name_match" | "missing" | "ambiguous";
  quota: string;
  branch: string;
  degree: string;
  specialty: string;
  specialty_code: string;
  category_raw: string;
  category_label: string;
  reservation: string;
  pwd: boolean | null;
  seats: number | null;
  remarks: string;
  source_pdf: string;
  source_url: string;
  source_label: string;
  page: number;
  verified: boolean;
  notes: string[];
};

export type Round2Reconciliation = {
  source_pdf: string;
  total_pages: number;
  pdf_pages_opened: number;
  pages_processed: number;
  extracted_records: number;
  verified_records: number;
  errors: number;
  complete: boolean;
};

export type Round2Validation = {
  extracted_at: string;
  dataset_complete: boolean;
  completion_rule: string;
  reconciliation: Round2Reconciliation[];
  seat_totals: {
    clear_vacancy_seats: number;
    clear_vacancy_verified_seats: number;
    virtual_vacancy_seats: number;
    virtual_vacancy_verified_seats: number;
    newly_added_seats: number;
    newly_added_verified_seats: number;
    note: string;
  };
  unique_colleges_in_round2: number;
  new_college_count: number;
  new_specialty_count: number;
  cross_document_overlaps: Record<
    string,
    { keys: number; sample_keys: string[] } & Record<string, number>
  >;
  code_recovery?: {
    recovered_unique_name: number;
    still_missing: number;
    ambiguous: number;
  };
  round1_comparison_available: boolean;
  errors_disclosed: Record<string, { error_count: number; unverified_records: number }>;
};

export type NewCollege = {
  institute_code: string;
  institute_name: string;
  state: string;
  institute_type: string;
  clear_seats: number;
  virtual_seats: number;
  new_seats: number;
  vacancy_types: string[];
};

export type NewSpecialty = {
  institute_code: string;
  institute_name: string;
  state: string;
  branch: string;
  degree: string;
  specialty: string;
  specialty_code: string;
  quota: string;
  page: number;
  source_pdf: string;
};

export type Round2Comparison = {
  round1_available: boolean;
  round1_sources: { name: string; rows?: number; pdf_pages?: number; declared_pages?: number; unverified_rows?: number; page_errors?: number; issues?: number }[];
  round1_college_codes: number;
  new_colleges: NewCollege[];
  new_college_count: number;
  new_specialties: NewSpecialty[];
  new_specialty_count: number;
  specialty_needs_review: { institute_code: string; institute_name: string; branch: string; reason: string }[];
  seat_increase_on_existing_keys_seats: number;
  seat_addition_on_new_keys_seats: number;
  seat_decreases: null;
  seat_decrease_note: string;
  colleges_with_no_round2_rows_count: number;
  comparison_note: string;
};

export type Round2Filters = {
  tab: "clear" | "virtual" | "new" | "new-colleges" | "all";
  q: string;
  state: string;
  type: string;
  degree: string;
  specialty: string;
  quota: string;
  category: string;
  vacancy: string;
  code: string;
  page: number;
};

const TAB_VACANCY: Record<string, VacancyType | null> = {
  clear: "clear",
  virtual: "virtual",
  new: "new",
  all: null,
  "new-colleges": null,
};

function repoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, "../.."), path.resolve(cwd, "..")];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data/mcc/2026/round_2/mcc_round2_records.json"))) return root;
  }
  return path.resolve(cwd, "../..");
}

function readJson<T>(name: string): T {
  const file = path.join(repoRoot(), "data/mcc/2026/round_2", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

type Cache = {
  records: Round2Record[];
  validation: Round2Validation;
  comparison: Round2Comparison;
  options: {
    states: string[];
    types: string[];
    degrees: string[];
    specialties: string[];
    quotas: string[];
    categories: string[];
  };
};

let cache: Cache | null = null;

export function loadRound2(): Cache {
  if (cache) return cache;
  const records = readJson<Round2Record[]>("mcc_round2_records.json");
  const validation = readJson<Round2Validation>("mcc_round2_validation_report.json");
  const comparison = readJson<Round2Comparison>("mcc_round2_comparison.json");
  const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  cache = {
    records,
    validation,
    comparison,
    options: {
      states: uniq(records.map((row) => row.state)),
      types: uniq(records.map((row) => row.institute_type)),
      degrees: uniq(records.map((row) => row.degree)),
      specialties: uniq(records.map((row) => row.specialty)),
      quotas: uniq(records.map((row) => row.quota)),
      categories: uniq(records.map((row) => row.category_raw)),
    },
  };
  return cache;
}

export function parseRound2Filters(params: Record<string, string | string[] | undefined>): Round2Filters {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const tabRaw = one("tab");
  const tab = (["clear", "virtual", "new", "new-colleges", "all"] as const).includes(tabRaw as Round2Filters["tab"])
    ? (tabRaw as Round2Filters["tab"])
    : "clear";
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);
  return {
    tab,
    q: one("q").trim(),
    state: one("state"),
    type: one("type"),
    degree: one("degree"),
    specialty: one("specialty"),
    quota: one("quota"),
    category: one("category"),
    vacancy: one("vacancy"),
    code: one("code").trim(),
    page,
  };
}

function matchesQuery(row: Round2Record, q: string): boolean {
  if (!q) return true;
  const hay = `${row.institute_name} ${row.institute} ${row.institute_code} ${row.specialty} ${row.specialty_code} ${row.branch}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function filterRecords(records: Round2Record[], filters: Round2Filters): Round2Record[] {
  const forced = TAB_VACANCY[filters.tab];
  const vacancy = forced ?? (filters.vacancy || null);
  const newCodes =
    filters.tab === "new-colleges"
      ? new Set(loadRound2().comparison.new_colleges.map((college) => college.institute_code))
      : null;
  return records.filter((row) => {
    if (vacancy && row.vacancy_type !== vacancy) return false;
    if (newCodes && !newCodes.has(row.institute_code)) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.type && row.institute_type !== filters.type) return false;
    if (filters.degree && row.degree !== filters.degree) return false;
    if (filters.specialty && row.specialty !== filters.specialty) return false;
    if (filters.quota && row.quota !== filters.quota) return false;
    if (filters.category && row.category_raw !== filters.category) return false;
    if (filters.code && row.institute_code !== filters.code) return false;
    return matchesQuery(row, filters.q);
  });
}

export function collegeSummary(records: Round2Record[], code: string) {
  const rows = records.filter((row) => row.institute_code === code);
  if (!rows.length) return null;
  const first = rows.find((row) => row.institute_code_source === "printed") ?? rows[0];
  const courses = new Map<string, {
    branch: string;
    degree: string;
    specialty: string;
    quota: string;
    clear: number;
    virtual: number;
    added: number;
    categories: { vacancy: VacancyType; category: string; seats: number; page: number; source: string; url: string }[];
  }>();
  for (const row of rows) {
    const key = `${row.branch}||${row.quota}`;
    const bucket = courses.get(key) ?? {
      branch: row.branch,
      degree: row.degree,
      specialty: row.specialty,
      quota: row.quota,
      clear: 0,
      virtual: 0,
      added: 0,
      categories: [],
    };
    const seats = typeof row.seats === "number" ? row.seats : 0;
    if (row.vacancy_type === "clear") bucket.clear += seats;
    if (row.vacancy_type === "virtual") bucket.virtual += seats;
    if (row.vacancy_type === "new") bucket.added += seats;
    bucket.categories.push({
      vacancy: row.vacancy_type,
      category: row.category_raw,
      seats,
      page: row.page,
      source: row.source_label,
      url: row.source_url,
    });
    courses.set(key, bucket);
  }
  const sum = (type: VacancyType) =>
    rows.reduce((total, row) => (row.vacancy_type === type && typeof row.seats === "number" ? total + row.seats : total), 0);
  return {
    code,
    name: first.institute_name,
    state: first.state,
    type: first.institute_type,
    address: first.institute,
    clear: sum("clear"),
    virtual: sum("virtual"),
    added: sum("new"),
    courses: [...courses.values()],
  };
}

export const VACANCY_LABEL: Record<VacancyType, string> = {
  clear: "Clear vacancy",
  virtual: "Virtual vacancy",
  new: "Newly added",
};
