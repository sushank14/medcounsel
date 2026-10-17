import Link from "next/link";
import { prisma } from "@medcounsel/database";
import {
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
  CATEGORY_LABELS,
  COLLEGE_TYPE_LABELS,
  displayCollegeName,
  INDIAN_STATES,
  MCC_SEAT_MATRIX_SOURCE_NOTE,
  SEAT_MATRIX_SOURCE_NOTE,
} from "@medcounsel/types";
import { Badge } from "@/components/ui/badge";
import { SeatMatrixAddToPreferences } from "@/components/seat-matrix/seat-matrix-add-to-preferences";
import { SeatMatrixCourseFilter } from "@/components/seat-matrix/seat-matrix-course-filter";
import { AddToChoiceButton } from "@/components/preference/add-to-choice-button";
import { seatMatrixHref } from "@/lib/seat-matrix-nav";
import { resolveSeatMatrixFilters } from "@/lib/seat-matrix-filters";

const PAGE_SIZE = 50;

const RESERVATION_CATEGORIES = ["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"] as const;

const QUOTA_LABELS: Record<string, string> = {
  AIQ: "All India Quota",
  STATE: "State Quota",
  MANAGEMENT: "Deemed / Management",
  IQ: "Central Internal",
  NRI: "NRI",
  IN_SERVICE: "In-Service",
};

export default async function SeatMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    year?: string;
    state?: string;
    degree?: string;
    course?: string | string[];
    quota?: string;
    category?: string;
    diffYear?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { source, matrixYear, reservationCategory, selectedCourses, where } =
    resolveSeatMatrixFilters(params);

  const diffYearParsed = params.diffYear ? parseInt(params.diffYear, 10) : NaN;
  const diffYear =
    source === "mcc" && Number.isFinite(diffYearParsed) && diffYearParsed !== matrixYear
      ? diffYearParsed
      : null;

  const nmcSourceWhere = { title: { contains: "NMC/MARB PG Seat Matrix" } };
  const mccSourceWhere = { title: { contains: "MCC NEET-PG official seat matrix" } };
  const matrixSourceWhere = source === "mcc" ? mccSourceWhere : nmcSourceWhere;
  const specialtyWhere = where.specialty;

  const coursePickerWhere = {
    year: matrixYear,
    source: matrixSourceWhere,
    college: { slug: { not: "" } },
    specialty: {
      slug: { not: "" },
      ...(params.degree ? { degree: params.degree as never } : {}),
    },
  };

  const [
    total,
    rows,
    seatSum,
    collegeCount,
    courseGroups,
    matchingCourseGroups,
    nmcStats,
    mcc2026Stats,
    mcc2025Stats,
    mcc2024Stats,
  ] = await Promise.all([
    prisma.seatMatrix.count({ where }),
    prisma.seatMatrix.findMany({
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      where,
      include: {
        college: {
          select: { id: true, slug: true, name: true, shortName: true, state: true, collegeType: true },
        },
        specialty: { select: { id: true, name: true, degree: true } },
      },
      orderBy: [
        { college: { state: "asc" } },
        { college: { name: "asc" } },
        { specialty: { degree: "asc" } },
        { category: "asc" },
      ],
    }),
    prisma.seatMatrix.aggregate({ where, _sum: { seats: true } }),
    prisma.seatMatrix.groupBy({ by: ["collegeId"], where }),
    prisma.seatMatrix.groupBy({
      by: ["specialtyId"],
      where: coursePickerWhere,
    }),
    prisma.seatMatrix.groupBy({ by: ["collegeId", "specialtyId"], where }),
    prisma.seatMatrix.aggregate({
      where: { year: ACTIVE_SEAT_MATRIX_YEAR, source: nmcSourceWhere },
      _sum: { seats: true },
      _count: true,
    }),
    prisma.seatMatrix.aggregate({
      where: { year: ACTIVE_MCC_SEAT_MATRIX_YEAR, source: mccSourceWhere },
      _sum: { seats: true },
      _count: true,
    }),
    prisma.seatMatrix.aggregate({
      where: { year: 2025, source: mccSourceWhere },
      _sum: { seats: true },
      _count: true,
    }),
    prisma.seatMatrix.aggregate({
      where: { year: 2024, source: mccSourceWhere },
      _sum: { seats: true },
      _count: true,
    }),
  ]);

  const courseOptions =
    courseGroups.length > 0
      ? await prisma.specialty.findMany({
          where: { id: { in: courseGroups.map((g) => g.specialtyId) } },
          orderBy: [{ degree: "asc" }, { name: "asc" }],
        })
      : [];

  const diffMap = new Map<string, number>();
  if (diffYear && rows.length > 0) {
    const diffRows = await prisma.seatMatrix.findMany({
      where: {
        year: diffYear,
        source: mccSourceWhere,
        collegeId: { in: [...new Set(rows.map((r) => r.collegeId))] },
        college: { slug: { not: "" } },
        ...(params.quota ? { quota: params.quota as never } : {}),
        ...(reservationCategory ? { category: reservationCategory as never } : {}),
        specialty: specialtyWhere,
      },
      select: {
        collegeId: true,
        specialtyId: true,
        quota: true,
        category: true,
        seats: true,
      },
    });
    for (const r of diffRows) {
      diffMap.set(`${r.collegeId}|${r.specialtyId}|${r.quota}|${r.category}`, r.seats);
    }
  }

  const diffYearOptions = [2026, 2025, 2024, 2023].filter((y) => y !== matrixYear);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterParams = {
    source: source === "mcc" ? "mcc" : undefined,
    year: source === "mcc" ? String(matrixYear) : undefined,
    state: params.state,
    degree: params.degree,
    course: selectedCourses.length ? selectedCourses : undefined,
    quota: params.quota,
    category: reservationCategory,
    diffYear: diffYear ? String(diffYear) : undefined,
    q: params.q,
  };

  const tableColSpan = 7 + (source === "mcc" ? 1 : 0) + (diffYear ? 2 : 0);

  const pageCourseCount = new Set(rows.map((r) => `${r.collegeId}|${r.specialtyId}`)).size;
  const allMatchingCourses = matchingCourseGroups.length;

  const courseLabels = new Map(
    courseOptions.map((sp) => [sp.slug, `${sp.degree} — ${sp.name}`])
  );
  const filterChips: { label: string; value: string }[] = [];
  if (source === "mcc") {
    filterChips.push({ label: "Source", value: `MCC ${matrixYear}` });
  } else {
    filterChips.push({ label: "Source", value: "NMC master matrix" });
  }
  if (params.state) filterChips.push({ label: "State", value: params.state });
  if (params.q) filterChips.push({ label: "College search", value: params.q });
  if (params.degree) filterChips.push({ label: "Course type", value: params.degree });
  if (selectedCourses.length) {
    filterChips.push({
      label: "Branches",
      value:
        selectedCourses.length <= 2
          ? selectedCourses.map((s) => courseLabels.get(s) ?? s).join("; ")
          : `${selectedCourses.length} selected`,
    });
  }
  if (params.quota) filterChips.push({ label: "Quota", value: QUOTA_LABELS[params.quota] ?? params.quota });
  if (reservationCategory) {
    filterChips.push({
      label: "Category",
      value: CATEGORY_LABELS[reservationCategory] ?? reservationCategory,
    });
  }

  const seatMatrixFilters = {
    source: params.source,
    year: params.year,
    state: params.state,
    degree: params.degree,
    course: params.course,
    quota: params.quota,
    category: params.category,
    q: params.q,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PG Seat Matrix</h1>
        <p className="text-slate-600">
          Official approved seats by college, course, and quota — NMC master matrix and MCC counselling matrices.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`card p-4 ${source === "nmc" ? "ring-2 ring-brand-500" : ""}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">NMC Master Matrix</p>
          <p className="mt-1 text-2xl font-bold">{nmcStats._sum.seats?.toLocaleString("en-IN") ?? "—"}</p>
          <p className="text-sm text-slate-600">
            {ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR} · {nmcStats._count.toLocaleString("en-IN")} course rows
          </p>
          <Link
            href={seatMatrixHref({ source: undefined })}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Browse NMC matrix →
          </Link>
        </div>
        <div
          className={`card p-4 ${source === "mcc" && matrixYear === ACTIVE_MCC_SEAT_MATRIX_YEAR ? "ring-2 ring-brand-500" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            MCC Counselling {ACTIVE_MCC_SEAT_MATRIX_YEAR}
          </p>
          <p className="mt-1 text-2xl font-bold">
            {mcc2026Stats._count > 0 ? mcc2026Stats._sum.seats?.toLocaleString("en-IN") : "—"}
          </p>
          <p className="text-sm text-slate-600">
            AIQ + Deemed + Central + DNB
            {mcc2026Stats._count > 0
              ? ` · ${mcc2026Stats._count.toLocaleString("en-IN")} rows`
              : " · import pending"}
          </p>
          <Link
            href={seatMatrixHref({ source: "mcc", year: String(ACTIVE_MCC_SEAT_MATRIX_YEAR) })}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Browse MCC {ACTIVE_MCC_SEAT_MATRIX_YEAR} →
          </Link>
        </div>
        <div className={`card p-4 ${source === "mcc" && matrixYear === 2025 ? "ring-2 ring-brand-500" : ""}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">MCC Counselling 2025</p>
          <p className="mt-1 text-2xl font-bold">
            {mcc2025Stats._count > 0 ? mcc2025Stats._sum.seats?.toLocaleString("en-IN") : "—"}
          </p>
          <p className="text-sm text-slate-600">
            {mcc2025Stats._count > 0
              ? `${mcc2025Stats._count.toLocaleString("en-IN")} course rows`
              : "Prior year matrix"}
          </p>
          <Link
            href={seatMatrixHref({ source: "mcc", year: "2025" })}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Browse MCC 2025 →
          </Link>
        </div>
        <div className={`card p-4 ${source === "mcc" && matrixYear === 2024 ? "ring-2 ring-brand-500" : ""}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">MCC Counselling 2024</p>
          <p className="mt-1 text-2xl font-bold">{mcc2024Stats._sum.seats?.toLocaleString("en-IN") ?? "—"}</p>
          <p className="text-sm text-slate-600">{mcc2024Stats._count.toLocaleString("en-IN")} course rows</p>
          <Link
            href={seatMatrixHref({ source: "mcc", year: "2024" })}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Browse MCC 2024 →
          </Link>
        </div>
      </div>

      <form method="GET" className="card flex flex-wrap gap-2 p-4">
        <select name="source" defaultValue={source} className="rounded-lg border px-3 py-2 text-sm">
          <option value="nmc">NMC master matrix</option>
          <option value="mcc">MCC counselling matrix</option>
        </select>
        {source === "mcc" && (
          <select name="year" defaultValue={String(matrixYear)} className="rounded-lg border px-3 py-2 text-sm">
            {[ACTIVE_MCC_SEAT_MATRIX_YEAR, 2025, 2024, 2023].map((y) => (
              <option key={y} value={y}>
                MCC {y}
              </option>
            ))}
          </select>
        )}

        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search college…"
          className="min-w-[160px] flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select name="state" defaultValue={params.state ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All states</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="degree" defaultValue={params.degree ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All course types</option>
          {["MD", "MS", "DNB", "DIPLOMA"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <SeatMatrixCourseFilter
          selected={selectedCourses}
          options={courseOptions.map((sp) => ({
            slug: sp.slug,
            label: `${sp.degree} — ${sp.name}`,
          }))}
        />
        {source === "mcc" && (
          <select name="quota" defaultValue={params.quota ?? ""} className="rounded-lg border px-3 py-2 text-sm">
            <option value="">All quotas</option>
            {["AIQ", "MANAGEMENT", "IQ", "NRI"].map((q) => (
              <option key={q} value={q}>
                {QUOTA_LABELS[q] ?? q}
              </option>
            ))}
          </select>
        )}
        <select
          name="category"
          defaultValue={reservationCategory ?? ""}
          className="rounded-lg border px-3 py-2 text-sm"
          aria-label="Reservation category"
        >
          <option value="">All categories</option>
          {RESERVATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        {source === "mcc" && diffYearOptions.length > 0 && (
          <select name="diffYear" defaultValue={diffYear ? String(diffYear) : ""} className="rounded-lg border px-3 py-2 text-sm">
            <option value="">No year diff</option>
            {diffYearOptions.map((y) => (
              <option key={y} value={y}>
                Diff vs MCC {y}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          Filter
        </button>
        {source === "nmc" && (
          <p className="w-full text-xs text-slate-500">
            NMC lists total approved seats per course. For General / EWS / OBC / SC / ST / PwD breakdown, choose{" "}
            <strong>MCC counselling matrix</strong> above.
          </p>
        )}
      </form>

      <SeatMatrixAddToPreferences
        filters={seatMatrixFilters}
        filterChips={filterChips}
        allMatchingCourses={allMatchingCourses}
        pageCourseCount={pageCourseCount}
        page={page}
        pageSize={PAGE_SIZE}
        disabled={total === 0}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {source === "nmc" ? (
            <>
              Showing <strong>NMC {ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR}</strong> master matrix — total approved intake
              per college & course (not round-wise vacancies).
            </>
          ) : (
            <>
              Showing <strong>MCC NEET-PG {matrixYear}</strong> counselling seat matrix — reservation category and
              quota-wise seats from official PDFs.
              {diffYear && (
                <>
                  {" "}
                  Comparing seat counts with <strong>MCC {diffYear}</strong> (same college, course, quota & category).
                </>
              )}
            </>
          )}
        </p>
        <p className="text-sm text-slate-500">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString("en-IN")} rows ·{" "}
          {collegeCount.length.toLocaleString("en-IN")} colleges ·{" "}
          {(seatSum._sum.seats ?? 0).toLocaleString("en-IN")} seats on this filter
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="p-3">College</th>
              <th className="p-3">State</th>
              <th className="p-3">Type</th>
              <th className="p-3">Course</th>
              {source === "mcc" && <th className="p-3">Quota</th>}
              <th className="p-3">Category</th>
              <th className="p-3">{diffYear ? `Seats ${matrixYear}` : "Seats"}</th>
              {diffYear && <th className="p-3">Seats {diffYear}</th>}
              {diffYear && <th className="p-3">Change</th>}
              <th className="p-3 w-[100px]">Choice list</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="p-8 text-center text-slate-500">
                  No seat matrix rows match these filters.
                  {source === "mcc" &&
                    matrixYear === ACTIVE_MCC_SEAT_MATRIX_YEAR &&
                    mcc2026Stats._count === 0 && (
                    <span className="mt-2 block text-sm">
                      MCC {ACTIVE_MCC_SEAT_MATRIX_YEAR} data has not been imported yet. Run{" "}
                      <code className="rounded bg-slate-100 px-1">npm run import:mcc-seat-matrix-2026</code> from
                      the project root.
                    </span>
                  )}
                  {source === "mcc" && mcc2026Stats._count > 0 && total === 0 && (
                    <span className="mt-2 block text-sm">
                      MCC {matrixYear} data is loaded — try clearing state, degree, or category filters, or pick{" "}
                      <strong>All categories</strong> (NMC totals are stored as General only).
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const diffKey = `${row.collegeId}|${row.specialtyId}|${row.quota}|${row.category}`;
                const prevSeats = diffYear ? diffMap.get(diffKey) : undefined;
                const delta =
                  diffYear && prevSeats !== undefined ? row.seats - prevSeats : diffYear ? null : undefined;

                return (
                  <tr key={row.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <Link href={`/colleges/${row.college.slug}`} className="text-brand-600 hover:underline">
                        {displayCollegeName(row.college.shortName || row.college.name)}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{row.college.state}</td>
                    <td className="p-3">
                      <Badge className="border-slate-200 bg-white text-slate-700">
                        {COLLEGE_TYPE_LABELS[row.college.collegeType] ?? row.college.collegeType}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {row.specialty.degree} {row.specialty.name}
                    </td>
                    {source === "mcc" && (
                      <td className="p-3 text-slate-600">{QUOTA_LABELS[row.quota] ?? row.quota}</td>
                    )}
                    <td className="p-3 text-slate-600">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                    <td className="p-3 font-medium">{row.seats}</td>
                    {diffYear && (
                      <td className="p-3 text-slate-600">{prevSeats !== undefined ? prevSeats : "—"}</td>
                    )}
                    {diffYear && (
                      <td
                        className={`p-3 font-medium ${
                          delta === null || delta === undefined
                            ? "text-slate-400"
                            : delta > 0
                              ? "text-emerald-700"
                              : delta < 0
                                ? "text-red-700"
                                : "text-slate-600"
                        }`}
                      >
                        {delta === null || delta === undefined
                          ? "—"
                          : delta > 0
                            ? `+${delta}`
                            : String(delta)}
                      </td>
                    )}
                    <td className="p-3">
                      <AddToChoiceButton
                        collegeId={row.college.id}
                        specialtyId={row.specialty.id}
                        compact
                        fitSnapshot={{
                          source: "seat-matrix",
                          seats: row.seats,
                          category: row.category,
                          quota: row.quota,
                          matrixYear,
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={seatMatrixHref(filterParams, page - 1)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={seatMatrixHref(filterParams, page + 1)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {source === "mcc" ? MCC_SEAT_MATRIX_SOURCE_NOTE : SEAT_MATRIX_SOURCE_NOTE}
      </p>
    </div>
  );
}
