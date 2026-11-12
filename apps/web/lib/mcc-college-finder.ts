export type FinderSource = "clear" | "virtual" | "new";
export type FinderGroup = "government_mdms" | "government_other" | "dnb" | "deemed" | "private" | "other";
export type SeatCategory = "OBC" | "Open" | "EWS" | "SC" | "ST" | "Unparsed";

export type FinderRecord = {
  id: string;
  source: FinderSource;
  state: string;
  officialType: string;
  group: FinderGroup;
  dnbKind: "" | "government" | "private";
  degree: string;
  institute: string;
  code: string;
  quota: string;
  branch: string;
  branchCode: string;
  category: string;
  seatCategory: SeatCategory;
  pwd: boolean;
  seats: number | null;
  page: number;
  flag: string;
};

export type SpecialtyId =
  | "md-radd"
  | "md-dvl"
  | "md-gmed"
  | "ms-obgy"
  | "md-ecc"
  | "ms-gsur"
  | "ms-opth"
  | "md-asth"
  | "other-mdms"
  | "dnb-med"
  | "dnb-obgy"
  | "dnb-surg"
  | "other-dnb";

export const SPECIALTY_FILTERS: { id: SpecialtyId; label: string; hint?: string }[] = [
  { id: "md-radd", label: "MD Radiodiagnosis", hint: "M.D. Radio-Diagnosis /Radiology (RADD)" },
  { id: "md-dvl", label: "MD Dermatology", hint: "M.D. Dermatology (DV-L)" },
  { id: "md-gmed", label: "MD General Medicine", hint: "M.D. General Medicine (GMED)" },
  { id: "ms-obgy", label: "MS Obstetrics and Gynaecology", hint: "MCC prints this as M.S. (OBGY), not M.D." },
  { id: "md-ecc", label: "MD Emergency Medicine", hint: "M.D. Emergency Medicine (E-CC)" },
  { id: "ms-gsur", label: "MS General Surgery", hint: "M.S. General Surgery (GSUR)" },
  { id: "ms-opth", label: "MS Ophthalmology", hint: "M.S. Ophthalmology (OPTH)" },
  { id: "md-asth", label: "MD Anaesthesiology", hint: "M.D. Anaesthesiology (ASTH)" },
  { id: "other-mdms", label: "Other MD/MS specialities" },
  { id: "dnb-med", label: "DNB General Medicine", hint: "(NBEMS) GENERAL MEDICINE (DMED)" },
  { id: "dnb-obgy", label: "DNB Obstetrics and Gynaecology", hint: "Includes DNB broad specialty (DOBG) and DNB diploma (NDGO)" },
  { id: "dnb-surg", label: "DNB General Surgery", hint: "(NBEMS) GENERAL SURGERY (DSUR)" },
  { id: "other-dnb", label: "Other DNB specialities" },
];

const NAMED_MDMS = new Set(["RADD", "DV-L", "GMED", "OBGY", "E-CC", "GSUR", "OPTH", "ASTH"]);
const NAMED_DNB = new Set(["DMED", "DOBG", "NDGO", "DSUR"]);

const SOURCE_LABEL: Record<FinderSource, string> = {
  clear: "Clear vacancy",
  virtual: "Virtual vacancy",
  new: "Newly added",
};

export function sourceLabel(source: FinderSource): string {
  return SOURCE_LABEL[source];
}

export function groupLabel(group: FinderGroup): string {
  if (group === "government_mdms" || group === "government_other") return "Government";
  if (group === "dnb") return "DNB";
  if (group === "deemed") return "Deemed";
  if (group === "private") return "Private";
  return "Needs review";
}

export function priorityRank(record: FinderRecord): number {
  if (record.group === "government_mdms") return 1;
  if (record.group === "government_other") return 2;
  if (record.group === "dnb") return 3;
  if (record.group === "private") return 4;
  if (record.group === "deemed") return 5;
  return 6;
}

export type FinderFilters = {
  q: string;
  city: string;
  state: string;
  group: string;
  category: "both" | "obc" | "open";
  source: string;
  specs: SpecialtyId[];
  sort: string;
  page: number;
  code: string;
  pick: string[];
};

const SPECIALTY_IDS = new Set(SPECIALTY_FILTERS.map((item) => item.id));

export function matchesSpecialty(record: FinderRecord, specs: SpecialtyId[]): boolean {
  if (specs.length === 0) return true;
  const code = record.branchCode;
  const mdms = record.degree === "MD" || record.degree === "MS";
  const dnb = record.degree === "DNB" || record.degree === "DNB Diploma";
  return specs.some((spec) => {
    if (spec === "md-radd") return code === "RADD";
    if (spec === "md-dvl") return code === "DV-L";
    if (spec === "md-gmed") return code === "GMED";
    if (spec === "ms-obgy") return code === "OBGY";
    if (spec === "md-ecc") return code === "E-CC";
    if (spec === "ms-gsur") return code === "GSUR";
    if (spec === "ms-opth") return code === "OPTH";
    if (spec === "md-asth") return code === "ASTH";
    if (spec === "other-mdms") return mdms && !NAMED_MDMS.has(code);
    if (spec === "dnb-med") return code === "DMED";
    if (spec === "dnb-obgy") return code === "DOBG" || code === "NDGO";
    if (spec === "dnb-surg") return code === "DSUR";
    if (spec === "other-dnb") return dnb && !NAMED_DNB.has(code);
    return false;
  });
}

export function matchesCategory(record: FinderRecord, category: FinderFilters["category"]): boolean {
  if (category === "obc") return record.seatCategory === "OBC";
  if (category === "open") return record.seatCategory === "Open";
  return record.seatCategory === "OBC" || record.seatCategory === "Open";
}

export function matchesGroup(record: FinderRecord, group: string): boolean {
  if (!group) return true;
  if (group === "government") return record.group === "government_mdms" || record.group === "government_other";
  return record.group === group;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function filterRecords(records: FinderRecord[], filters: FinderFilters, options?: { ignoreCategory?: boolean }): FinderRecord[] {
  const q = filters.q.trim();
  const city = filters.city.trim();
  return records.filter((record) => {
    if (!options?.ignoreCategory && !matchesCategory(record, filters.category)) return false;
    if (filters.state && record.state !== filters.state) return false;
    if (filters.source && record.source !== filters.source) return false;
    if (!matchesGroup(record, filters.group)) return false;
    if (!matchesSpecialty(record, filters.specs)) return false;
    if (filters.code && record.code !== filters.code) return false;
    if (q) {
      const hay = `${record.institute} ${record.code} ${record.branch} ${record.branchCode}`;
      if (!includesText(hay, q)) return false;
    }
    if (city && !includesText(record.institute, city)) return false;
    return true;
  });
}

export function sortRecords(records: FinderRecord[], sort: string): FinderRecord[] {
  const copy = [...records];
  const byName = (a: FinderRecord, b: FinderRecord) => a.institute.localeCompare(b.institute) || a.branch.localeCompare(b.branch) || a.category.localeCompare(b.category);
  copy.sort((a, b) => {
    if (sort === "type") return a.officialType.localeCompare(b.officialType) || byName(a, b);
    if (sort === "state") return a.state.localeCompare(b.state) || byName(a, b);
    if (sort === "city" || sort === "name") return byName(a, b);
    if (sort === "specialty") return a.branch.localeCompare(b.branch) || byName(a, b);
    if (sort === "obc") return Number(b.seatCategory === "OBC") - Number(a.seatCategory === "OBC") || (b.seats ?? -1) - (a.seats ?? -1) || byName(a, b);
    if (sort === "open") return Number(b.seatCategory === "Open") - Number(a.seatCategory === "Open") || (b.seats ?? -1) - (a.seats ?? -1) || byName(a, b);
    if (sort === "clear" || sort === "virtual" || sort === "new") {
      const source = sort === "new" ? "new" : sort;
      return Number(b.source === source) - Number(a.source === source) || (b.seats ?? -1) - (a.seats ?? -1) || byName(a, b);
    }
    return priorityRank(a) - priorityRank(b) || (a.dnbKind === "government" ? 0 : 1) - (b.dnbKind === "government" ? 0 : 1) || byName(a, b);
  });
  return copy;
}

export type SourceTotals = { rows: number; seats: number };

export function sourceTotals(records: FinderRecord[]): Record<FinderSource, SourceTotals> {
  const totals: Record<FinderSource, SourceTotals> = {
    clear: { rows: 0, seats: 0 },
    virtual: { rows: 0, seats: 0 },
    new: { rows: 0, seats: 0 },
  };
  for (const record of records) {
    totals[record.source].rows += 1;
    if (typeof record.seats === "number") totals[record.source].seats += record.seats;
  }
  return totals;
}

export function parseFinderFilters(params: Record<string, string | string[] | undefined>): FinderFilters {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const many = (key: string) => {
    const value = params[key];
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.filter((item): item is SpecialtyId => SPECIALTY_IDS.has(item as SpecialtyId));
  };
  const categoryRaw = one("category");
  const category = categoryRaw === "obc" || categoryRaw === "open" ? categoryRaw : "both";
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);
  const pick = one("pick")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    q: one("q").trim(),
    city: one("city").trim(),
    state: one("state"),
    group: one("group"),
    category,
    source: one("source"),
    specs: many("spec"),
    sort: one("sort") || "priority",
    page,
    code: one("code").trim(),
    pick,
  };
}

export type CompareLine = {
  code: string;
  institute: string;
  state: string;
  officialType: string;
  group: FinderGroup;
  branch: string;
  degree: string;
  quota: string;
  category: string;
  seatCategory: SeatCategory;
  pwd: boolean;
  clearSeats: number;
  clearRows: number;
  virtualSeats: number;
  virtualRows: number;
  newSeats: number;
  newRows: number;
  pages: string[];
};

export function compareColleges(records: FinderRecord[], codes: string[]): CompareLine[] {
  const wanted = new Set(codes);
  const grouped = new Map<string, CompareLine>();
  for (const record of records) {
    if (!wanted.has(record.code)) continue;
    const key = [record.code, record.branch, record.quota, record.category].join("|");
    let line = grouped.get(key);
    if (!line) {
      line = {
        code: record.code,
        institute: record.institute,
        state: record.state,
        officialType: record.officialType,
        group: record.group,
        branch: record.branch,
        degree: record.degree,
        quota: record.quota,
        category: record.category,
        seatCategory: record.seatCategory,
        pwd: record.pwd,
        clearSeats: 0,
        clearRows: 0,
        virtualSeats: 0,
        virtualRows: 0,
        newSeats: 0,
        newRows: 0,
        pages: [],
      };
      grouped.set(key, line);
    }
    const seats = record.seats ?? 0;
    if (record.source === "clear") {
      line.clearSeats += seats;
      line.clearRows += 1;
    } else if (record.source === "virtual") {
      line.virtualSeats += seats;
      line.virtualRows += 1;
    } else {
      line.newSeats += seats;
      line.newRows += 1;
    }
    line.pages.push(`${sourceLabel(record.source)} p.${record.page}`);
  }
  return [...grouped.values()].sort(
    (a, b) => priorityRank({ group: a.group } as FinderRecord) - priorityRank({ group: b.group } as FinderRecord) || a.institute.localeCompare(b.institute) || a.branch.localeCompare(b.branch) || a.category.localeCompare(b.category)
  );
}
