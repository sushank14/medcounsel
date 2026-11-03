import {
  ACTIVE_MAH_SEAT_MATRIX_YEAR,
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
} from "@medcounsel/types";
import type { Prisma } from "@medcounsel/database";
import { parseCourseSlugs } from "@/lib/seat-matrix-nav";

/** Seat matrix UI is limited to Open (General) and OBC — counselling categories most applicants use. */
export const SEAT_MATRIX_CATEGORIES = ["GENERAL", "OBC"] as const;

/** Maharashtra state matrix — all reservation columns from official PDFs/sheets. */
export const MAH_SEAT_MATRIX_CATEGORIES = ["GENERAL", "OBC", "SC", "ST", "EWS", "PWD"] as const;

export type SeatMatrixSource = "nmc" | "mcc" | "maharashtra";

/** MCC sheets label unreserved seats as Open; stored as GENERAL in the DB. */
export const SEAT_MATRIX_CATEGORY_PARAM = {
  ALL: "",
  OPEN: "OPEN",
  OBC: "OBC",
  SC: "SC",
  ST: "ST",
  EWS: "EWS",
} as const;

export const SEAT_MATRIX_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Open (General)",
  OPEN: "Open (General)",
  OBC: "OBC (Non-Creamy Layer)",
  SC: "SC",
  ST: "ST",
  EWS: "EWS",
  PWD: "PwD",
};

export type SeatMatrixSearchParams = {
  source?: string;
  year?: string;
  state?: string;
  degree?: string;
  course?: string | string[];
  quota?: string;
  category?: string;
  q?: string;
};

export function normalizeSeatMatrixCategoryParam(
  raw?: string,
  source?: SeatMatrixSource
): {
  reservationCategory?: string;
  categoryParam?: string;
} {
  if (!raw) {
    return { categoryParam: undefined };
  }
  const upper = raw.toUpperCase();
  if (upper === SEAT_MATRIX_CATEGORY_PARAM.OPEN || upper === "GENERAL") {
    return {
      reservationCategory: "GENERAL",
      categoryParam: SEAT_MATRIX_CATEGORY_PARAM.OPEN,
    };
  }
  if (upper === SEAT_MATRIX_CATEGORY_PARAM.OBC) {
    return {
      reservationCategory: "OBC",
      categoryParam: SEAT_MATRIX_CATEGORY_PARAM.OBC,
    };
  }
  if (source === "maharashtra") {
    if (upper === "SC") return { reservationCategory: "SC", categoryParam: "SC" };
    if (upper === "ST") return { reservationCategory: "ST", categoryParam: "ST" };
    if (upper === "EWS") return { reservationCategory: "EWS", categoryParam: "EWS" };
  }
  return { categoryParam: undefined };
}

export function seatMatrixCategoryLabel(categoryParam?: string, reservationCategory?: string): string {
  if (categoryParam === SEAT_MATRIX_CATEGORY_PARAM.OPEN || reservationCategory === "GENERAL") {
    return SEAT_MATRIX_CATEGORY_LABELS.OPEN;
  }
  if (reservationCategory === "OBC" || categoryParam === SEAT_MATRIX_CATEGORY_PARAM.OBC) {
    return SEAT_MATRIX_CATEGORY_LABELS.OBC;
  }
  if (reservationCategory && SEAT_MATRIX_CATEGORY_LABELS[reservationCategory]) {
    return SEAT_MATRIX_CATEGORY_LABELS[reservationCategory];
  }
  return "Open & OBC";
}

function seatMatrixCategoryWhere(
  source: SeatMatrixSource,
  reservationCategory?: string
): Prisma.SeatMatrixWhereInput["category"] {
  if (reservationCategory) {
    return reservationCategory as never;
  }
  if (source === "maharashtra") {
    return undefined;
  }
  return { in: [...SEAT_MATRIX_CATEGORIES] };
}

export function resolveSeatMatrixSource(raw?: string): SeatMatrixSource {
  if (raw === "mcc") return "mcc";
  if (raw === "maharashtra" || raw === "mah") return "maharashtra";
  return "nmc";
}

export function mahSeatMatrixSourceWhere(): Prisma.SourceWhereInput {
  return {
    OR: [
      { title: { contains: "MAHACET NEET-PG" } },
      { title: { contains: "Maharashtra 2025 seat matrix" } },
    ],
  };
}

export function resolveSeatMatrixFilters(params: SeatMatrixSearchParams) {
  const source = resolveSeatMatrixSource(params.source);
  const matrixYear =
    source === "nmc"
      ? ACTIVE_SEAT_MATRIX_YEAR
      : source === "maharashtra"
        ? parseInt(params.year ?? String(ACTIVE_MAH_SEAT_MATRIX_YEAR), 10) || ACTIVE_MAH_SEAT_MATRIX_YEAR
        : parseInt(params.year ?? String(ACTIVE_MCC_SEAT_MATRIX_YEAR), 10) || ACTIVE_MCC_SEAT_MATRIX_YEAR;
  const { reservationCategory, categoryParam } = normalizeSeatMatrixCategoryParam(params.category, source);
  const selectedCourses = parseCourseSlugs(params.course);
  const degreeWhere = resolveDegreeWhere(params.degree);

  const nmcSourceWhere = { title: { contains: "NMC/MARB PG Seat Matrix" } };
  const mccSourceWhere = { title: { contains: "MCC NEET-PG official seat matrix" } };
  const matrixSourceWhere =
    source === "mcc" ? mccSourceWhere : source === "maharashtra" ? mahSeatMatrixSourceWhere() : nmcSourceWhere;

  const specialtyWhere: Prisma.SpecialtyWhereInput = {
    ...degreeWhere,
    ...(selectedCourses.length === 1
      ? { slug: selectedCourses[0] }
      : selectedCourses.length > 1
        ? { slug: { in: selectedCourses } }
        : { slug: { not: "" } }),
  };

  const categoryFilter = seatMatrixCategoryWhere(source, reservationCategory);

  const where: Prisma.SeatMatrixWhereInput = {
    year: matrixYear,
    source: matrixSourceWhere,
    ...(params.quota ? { quota: params.quota as never } : {}),
    ...(categoryFilter ? { category: categoryFilter as never } : {}),
    college: {
      slug: { not: "" },
      state: source === "maharashtra" ? "Maharashtra" : params.state ? params.state : undefined,
      ...(params.q ? { name: { contains: params.q } } : {}),
    },
    specialty: specialtyWhere,
  };

  return {
    source,
    matrixYear,
    reservationCategory,
    categoryParam,
    selectedCourses,
    where,
    matrixSourceWhere,
  };
}

/** Prisma specialty.degree filter — `MD_MS` means both MD and MS (PG clinical degrees). */
export function resolveDegreeWhere(degree?: string): Prisma.SpecialtyWhereInput {
  if (!degree) return {};
  if (degree === "MD_MS") return { degree: { in: ["MD", "MS"] } };
  return { degree: degree as Prisma.EnumDegreeFilter["equals"] };
}

export function degreeFilterLabel(degree: string): string {
  if (degree === "MD_MS") return "MD / MS";
  return degree;
}
