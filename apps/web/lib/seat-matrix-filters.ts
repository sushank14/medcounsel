import {
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
} from "@medcounsel/types";
import type { Prisma } from "@medcounsel/database";
import { parseCourseSlugs } from "@/lib/seat-matrix-nav";

/** Seat matrix UI is limited to Open (General) and OBC — counselling categories most applicants use. */
export const SEAT_MATRIX_CATEGORIES = ["GENERAL", "OBC"] as const;

/** MCC sheets label unreserved seats as Open; stored as GENERAL in the DB. */
export const SEAT_MATRIX_CATEGORY_PARAM = {
  ALL: "",
  OPEN: "OPEN",
  OBC: "OBC",
} as const;

export const SEAT_MATRIX_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Open (General)",
  OPEN: "Open (General)",
  OBC: "OBC (Non-Creamy Layer)",
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

export function normalizeSeatMatrixCategoryParam(raw?: string): {
  /** When set, filter to this category only; otherwise Open + OBC together. */
  reservationCategory?: (typeof SEAT_MATRIX_CATEGORIES)[number];
  /** Value to keep in URLs / form controls (OPEN, OBC, …). */
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
  return { categoryParam: undefined };
}

export function seatMatrixCategoryLabel(categoryParam?: string, reservationCategory?: string): string {
  if (categoryParam === SEAT_MATRIX_CATEGORY_PARAM.OPEN || reservationCategory === "GENERAL") {
    return SEAT_MATRIX_CATEGORY_LABELS.OPEN;
  }
  if (reservationCategory === "OBC" || categoryParam === SEAT_MATRIX_CATEGORY_PARAM.OBC) {
    return SEAT_MATRIX_CATEGORY_LABELS.OBC;
  }
  return "Open & OBC";
}

function seatMatrixCategoryWhere(
  reservationCategory?: (typeof SEAT_MATRIX_CATEGORIES)[number]
): Prisma.SeatMatrixWhereInput["category"] {
  if (reservationCategory) {
    return reservationCategory;
  }
  return { in: [...SEAT_MATRIX_CATEGORIES] };
}

export function resolveSeatMatrixFilters(params: SeatMatrixSearchParams) {
  const source = params.source === "mcc" ? "mcc" : "nmc";
  const matrixYear =
    source === "nmc"
      ? ACTIVE_SEAT_MATRIX_YEAR
      : parseInt(params.year ?? String(ACTIVE_MCC_SEAT_MATRIX_YEAR), 10) || ACTIVE_MCC_SEAT_MATRIX_YEAR;
  const { reservationCategory, categoryParam } = normalizeSeatMatrixCategoryParam(params.category);
  const selectedCourses = parseCourseSlugs(params.course);
  const degreeWhere = resolveDegreeWhere(params.degree);

  const nmcSourceWhere = { title: { contains: "NMC/MARB PG Seat Matrix" } };
  const mccSourceWhere = { title: { contains: "MCC NEET-PG official seat matrix" } };
  const matrixSourceWhere = source === "mcc" ? mccSourceWhere : nmcSourceWhere;

  const specialtyWhere: Prisma.SpecialtyWhereInput = {
    ...degreeWhere,
    ...(selectedCourses.length === 1
      ? { slug: selectedCourses[0] }
      : selectedCourses.length > 1
        ? { slug: { in: selectedCourses } }
        : { slug: { not: "" } }),
  };

  const where = {
    year: matrixYear,
    source: matrixSourceWhere,
    ...(params.quota ? { quota: params.quota as never } : {}),
    category: seatMatrixCategoryWhere(reservationCategory) as never,
    college: {
      slug: { not: "" },
      ...(params.state ? { state: params.state } : {}),
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
