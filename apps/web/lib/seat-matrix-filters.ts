import {
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
} from "@medcounsel/types";
import type { Prisma } from "@medcounsel/database";
import { parseCourseSlugs } from "@/lib/seat-matrix-nav";

const RESERVATION_CATEGORIES = ["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"] as const;

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

export function resolveSeatMatrixFilters(params: SeatMatrixSearchParams) {
  const source = params.source === "mcc" ? "mcc" : "nmc";
  const matrixYear =
    source === "nmc"
      ? ACTIVE_SEAT_MATRIX_YEAR
      : parseInt(params.year ?? String(ACTIVE_MCC_SEAT_MATRIX_YEAR), 10) || ACTIVE_MCC_SEAT_MATRIX_YEAR;
  const reservationCategory =
    params.category && RESERVATION_CATEGORIES.includes(params.category as (typeof RESERVATION_CATEGORIES)[number])
      ? params.category
      : undefined;
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
    ...(reservationCategory ? { category: reservationCategory as never } : {}),
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
