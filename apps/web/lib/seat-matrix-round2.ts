import { loadFinder } from "@/lib/mcc-college-finder-data";
import {
  filterRecords,
  groupLabel,
  sortRecords,
  sourceLabel,
  sourceTotals,
  type FinderFilters,
  type FinderRecord,
  type FinderSource,
  type SourceTotals,
} from "@/lib/mcc-college-finder";

export type Round2MatrixView = {
  rows: FinderRecord[];
  total: number;
  page: number;
  pageCount: number;
  totals: Record<FinderSource, SourceTotals>;
  states: string[];
};

function categoryFilter(raw?: string): FinderFilters["category"] {
  const upper = (raw ?? "").toUpperCase();
  if (upper === "OPEN" || upper === "GENERAL") return "open";
  if (upper === "OBC") return "obc";
  return "both";
}

function vacancyFilter(raw?: string): FinderFilters["source"] {
  if (raw === "clear" || raw === "virtual" || raw === "new") return raw;
  return "";
}

function groupFilter(raw?: string): string {
  if (raw === "government" || raw === "dnb" || raw === "deemed") return raw;
  return "";
}

function matchesDegree(record: FinderRecord, degree?: string): boolean {
  if (!degree) return true;
  if (degree === "MD_MS") return record.degree === "MD" || record.degree === "MS";
  if (degree === "DNB") return record.degree === "DNB" || record.degree === "DNB Diploma";
  if (degree === "DIPLOMA") return record.degree === "Diploma" || record.degree === "DNB Diploma";
  return record.degree === degree;
}

export function round2AvailabilityLabel(source: FinderSource): string {
  return sourceLabel(source);
}

export function round2InstituteLabel(record: FinderRecord): string {
  const kind = record.dnbKind ? ` · ${record.dnbKind} DNB` : "";
  return `${groupLabel(record.group)}${kind}`;
}

/** OBC and Open rows from the verified 11 November Round 2 Excel index. */
export function loadRound2SeatMatrix(
  params: {
    q?: string;
    state?: string;
    degree?: string;
    category?: string;
    vacancy?: string;
    group?: string;
  },
  page: number,
  pageSize: number
): Round2MatrixView {
  const { records, states } = loadFinder();
  const base: FinderFilters = {
    q: params.q?.trim() ?? "",
    city: "",
    state: params.state ?? "",
    group: groupFilter(params.group),
    category: categoryFilter(params.category),
    source: "",
    specs: [],
    sort: "priority",
    page: 1,
    code: "",
    pick: [],
  };
  const scoped = sortRecords(
    filterRecords(records, base).filter((record) => matchesDegree(record, params.degree)),
    "priority"
  );
  const vacancy = vacancyFilter(params.vacancy);
  const filtered = vacancy ? scoped.filter((record) => record.source === vacancy) : scoped;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    rows: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: filtered.length,
    page: safePage,
    pageCount,
    totals: sourceTotals(scoped),
    states,
  };
}
