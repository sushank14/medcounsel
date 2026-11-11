import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { loadCutoffClosesForSeatRows } from "@/lib/seat-matrix-cutoff-join";
import { formatRank } from "@/lib/utils";
import {
  ACTIVE_MAH_SEAT_MATRIX_YEAR,
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
  COLLEGE_TYPE_LABELS,
  displayCollegeName,
  INDIAN_STATES,
  MAH_SEAT_MATRIX_SOURCE_NOTE,
  MCC_SEAT_MATRIX_SOURCE_NOTE,
  SEAT_MATRIX_SOURCE_NOTE,
} from "@medcounsel/types";
import { Badge } from "@/components/ui/badge";
import { SeatMatrixAddToPreferences } from "@/components/seat-matrix/seat-matrix-add-to-preferences";
import { SeatMatrixCourseFilter } from "@/components/seat-matrix/seat-matrix-course-filter";
import { AddToChoiceButton } from "@/components/preference/add-to-choice-button";
import { seatMatrixHref } from "@/lib/seat-matrix-nav";
import {
  degreeFilterLabel,
  resolveDegreeWhere,
  mahSeatMatrixSourceWhere,
  resolveSeatMatrixFilters,
  SEAT_MATRIX_CATEGORIES,
  SEAT_MATRIX_CATEGORY_LABELS,
  SEAT_MATRIX_CATEGORY_PARAM,
  seatMatrixCategoryLabel,
} from "@/lib/seat-matrix-filters";
import { fieldInput, fieldSelect, sectionCard, sectionTitle } from "@/lib/form-field-classes";
import { PageHeader } from "@/components/layout/page-header";

const PAGE_SIZE = 50;

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
    mhRanks?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const profile = session?.user?.id
    ? await prisma.candidateProfile.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { rank: true, rankType: true, category: true, domicileState: true, counsellingPref: true },
      })
    : null;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { source, matrixYear, reservationCategory, categoryParam, selectedCourses, where, matrixSourceWhere } =
    resolveSeatMatrixFilters(params);

  const diffYearParsed = params.diffYear ? parseInt(params.diffYear, 10) : NaN;
  const diffYear =
    source === "mcc" && Number.isFinite(diffYearParsed) && diffYearParsed !== matrixYear
      ? diffYearParsed
      : null;

  const nmcSourceWhere = { title: { contains: "NMC/MARB PG Seat Matrix" } };
  const mccSourceWhere = { title: { contains: "MCC NEET-PG official seat matrix" } };
  const specialtyWhere = where.specialty;

  const coursePickerWhere = {
    year: matrixYear,
    source: matrixSourceWhere,
    college: { slug: { not: "" } },
    specialty: {
      slug: { not: "" },
      ...resolveDegreeWhere(params.degree),
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
    mah2026Stats,
    mah2025Stats,
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
    prisma.seatMatrix.aggregate({
      where: { year: ACTIVE_MAH_SEAT_MATRIX_YEAR, source: mahSeatMatrixSourceWhere(), college: { state: "Maharashtra" } },
      _sum: { seats: true },
      _count: true,
    }),
    prisma.seatMatrix.aggregate({
      where: { year: 2025, source: mahSeatMatrixSourceWhere(), college: { state: "Maharashtra" } },
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
    const diffWhere = {
      year: diffYear,
      source: mccSourceWhere,
      collegeId: { in: [...new Set(rows.map((r) => r.collegeId))] },
      college: { slug: { not: "" } },
      ...(params.quota ? { quota: params.quota as never } : {}),
      category: reservationCategory
        ? (reservationCategory as never)
        : ({ in: [...SEAT_MATRIX_CATEGORIES] } as never),
      specialty: specialtyWhere,
    };
    const diffRows = await prisma.seatMatrix.findMany({
      where: diffWhere,
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

  const showMaharashtraRanks =
    (source === "mcc" && (params.state === "Maharashtra" || params.mhRanks === "1")) ||
    source === "maharashtra";

  const cutoffCloses =
    showMaharashtraRanks && rows.length > 0
      ? await loadCutoffClosesForSeatRows(
          rows.map((r) => ({
            collegeId: r.collegeId,
            specialtyId: r.specialtyId,
            category: r.category,
          })),
          { smlYear: 2025, airYear: 2025, includeProvisionalAiq: true }
        )
      : new Map();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterParams = {
    source: source === "nmc" ? undefined : source,
    year: source === "mcc" || source === "maharashtra" ? String(matrixYear) : undefined,
    state: params.state,
    degree: params.degree,
    course: selectedCourses.length ? selectedCourses : undefined,
    quota: params.quota,
    category: categoryParam ?? params.category,
    diffYear: diffYear ? String(diffYear) : undefined,
    q: params.q,
  };

  const rankColCount = showMaharashtraRanks ? (profile ? 3 : 2) : 0;
  const showQuotaCol = source === "mcc" || source === "maharashtra";
  const tableColSpan = 7 + (showQuotaCol ? 1 : 0) + (diffYear ? 2 : 0) + rankColCount;

  const pageCourseCount = new Set(rows.map((r) => `${r.collegeId}|${r.specialtyId}`)).size;
  const allMatchingCourses = matchingCourseGroups.length;

  const courseLabels = new Map(
    courseOptions.map((sp) => [sp.slug, `${sp.degree} — ${sp.name}`])
  );
  const filterChips: { label: string; value: string }[] = [];
  if (source === "mcc") {
    filterChips.push({ label: "Source", value: `MCC ${matrixYear}` });
  } else if (source === "maharashtra") {
    filterChips.push({ label: "Source", value: `MAHACET ${matrixYear}` });
  } else {
    filterChips.push({ label: "Source", value: "NMC master matrix" });
  }
  if (params.state) filterChips.push({ label: "State", value: params.state });
  if (params.q) filterChips.push({ label: "College search", value: params.q });
  if (params.degree) filterChips.push({ label: "Course type", value: degreeFilterLabel(params.degree) });
  if (selectedCourses.length) {
    filterChips.push({
      label: "Branches",
      value:
        selectedCourses.length <= 4
          ? selectedCourses.map((s) => courseLabels.get(s) ?? s).join("; ")
          : `${selectedCourses.length} branches selected`,
    });
  }
  if (params.quota) filterChips.push({ label: "Quota", value: QUOTA_LABELS[params.quota] ?? params.quota });
  if (categoryParam || reservationCategory) {
    filterChips.push({
      label: "Seats",
      value: seatMatrixCategoryLabel(categoryParam, reservationCategory),
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
    <div className="page">
      <PageHeader
        title="PG Seat Matrix"
        description="Official approved seats by college, course, and quota — NMC master matrix and MCC counselling matrices."
        actions={
          <Link href="/mcc-round-2" className="text-sm font-medium text-brand-600 hover:underline">
            MCC Round 2 vacancies →
          </Link>
        }
      />

      {params.state !== "Maharashtra" && (
        <div className="card card-tile border-indigo-100 bg-indigo-50/50 p-4 text-sm text-slate-700">
          <p className="font-medium text-indigo-950">Maharashtra candidates</p>
          <p className="mt-1">
            Compare <strong>2026 vs 2025</strong> MCC seats at Maharashtra institutes with{" "}
            <strong>2025 SML</strong> (state CAP) and <strong>AIQ</strong> closing ranks.
          </p>
          <Link
            href={seatMatrixHref({
              source: "mcc",
              year: String(ACTIVE_MCC_SEAT_MATRIX_YEAR),
              state: "Maharashtra",
              diffYear: "2025",
              mhRanks: "1",
            })}
            className="mt-2 inline-block font-medium text-brand-600 hover:underline"
          >
            Open Maharashtra seat matrix + ranks →
          </Link>
          <Link href="/seat-matrix/compare" className="mt-2 ml-4 inline-block font-medium text-brand-600 hover:underline">
            MAHACET govt matrix 2025 vs 2026 →
          </Link>
        </div>
      )}

      {showMaharashtraRanks && (
        <p className="text-sm text-slate-600">
          <strong>Maharashtra view:</strong> Seat counts from official MCC matrices.{" "}
          <strong>2025 SML close</strong> = Maharashtra CAP Round 1 (state quota counselling).{" "}
          <strong>AIQ close</strong> = MCC All India Quota at the same college (2025 final or 2026 R1 provisional).
          State-quota seat counts are not split in MCC PDFs — use NMC master matrix for total approved intake.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`card card-tile ${source === "nmc" ? "ring-2 ring-brand-500" : ""}`}>
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
          className={`card card-tile ${source === "mcc" && matrixYear === ACTIVE_MCC_SEAT_MATRIX_YEAR ? "ring-2 ring-brand-500" : ""}`}
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
        <div className={`card card-tile ${source === "mcc" && matrixYear === 2025 ? "ring-2 ring-brand-500" : ""}`}>
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
        <div className={`card card-tile ${source === "mcc" && matrixYear === 2024 ? "ring-2 ring-brand-500" : ""}`}>
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
        <div
          className={`card card-tile border-orange-100 ${source === "maharashtra" && matrixYear === ACTIVE_MAH_SEAT_MATRIX_YEAR ? "ring-2 ring-orange-500" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-orange-800">Maharashtra MAHACET {ACTIVE_MAH_SEAT_MATRIX_YEAR}</p>
          <p className="mt-1 text-2xl font-bold">
            {mah2026Stats._count > 0 ? mah2026Stats._sum.seats?.toLocaleString("en-IN") : "—"}
          </p>
          <p className="text-sm text-slate-600">
            State quota · govt R1
            {mah2026Stats._count > 0 ? ` · ${mah2026Stats._count.toLocaleString("en-IN")} rows` : " · import pending"}
          </p>
          <Link
            href={seatMatrixHref({ source: "maharashtra", year: String(ACTIVE_MAH_SEAT_MATRIX_YEAR) })}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Browse MAHACET matrix →
          </Link>
        </div>
      </div>

      <form method="GET" className={`${sectionCard} section-block`}>
        <p className={sectionTitle}>Filters</p>
        <div className="filter-row">
        <select name="source" defaultValue={source} className={fieldSelect}>
          <option value="nmc">NMC master matrix</option>
          <option value="mcc">MCC counselling matrix</option>
          <option value="maharashtra">Maharashtra MAHACET (state)</option>
        </select>
        {source === "mcc" && (
          <select name="year" defaultValue={String(matrixYear)} className={fieldSelect}>
            {[ACTIVE_MCC_SEAT_MATRIX_YEAR, 2025, 2024, 2023].map((y) => (
              <option key={y} value={y}>
                MCC {y}
              </option>
            ))}
          </select>
        )}
        {source === "maharashtra" && (
          <select name="year" defaultValue={String(matrixYear)} className={fieldSelect}>
            {[ACTIVE_MAH_SEAT_MATRIX_YEAR, 2025].map((y) => (
              <option key={y} value={y}>
                MAHACET {y}
              </option>
            ))}
          </select>
        )}

        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search college…"
          className={`${fieldInput} min-w-[180px] flex-[1_1_200px]`}
        />
        {source !== "maharashtra" && (
          <select name="state" defaultValue={params.state ?? ""} className={fieldSelect}>
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select name="degree" defaultValue={params.degree ?? ""} className={fieldSelect}>
          <option value="">All course types</option>
          <option value="MD_MS">MD / MS</option>
          <option value="DNB">DNB</option>
          <option value="DIPLOMA">Diploma</option>
        </select>
        <SeatMatrixCourseFilter
          key={selectedCourses.join("\0")}
          selected={selectedCourses}
          options={courseOptions.map((sp) => ({
            slug: sp.slug,
            label: `${sp.degree} — ${sp.name}`,
          }))}
        />
        {source === "mcc" && (
          <select name="quota" defaultValue={params.quota ?? ""} className={fieldSelect}>
            <option value="">All quotas</option>
            {["AIQ", "MANAGEMENT", "IQ", "NRI", "STATE"].map((q) => (
              <option key={q} value={q}>
                {QUOTA_LABELS[q] ?? q}
              </option>
            ))}
          </select>
        )}
        {source === "maharashtra" && (
          <select name="quota" defaultValue={params.quota ?? ""} className={fieldSelect}>
            <option value="">All quotas</option>
            {["STATE", "IN_SERVICE"].map((q) => (
              <option key={q} value={q}>
                {QUOTA_LABELS[q] ?? q}
              </option>
            ))}
          </select>
        )}
        <select
          name="category"
          defaultValue={categoryParam ?? ""}
          className={fieldSelect}
          aria-label="Reservation category"
        >
          {source === "maharashtra" ? (
            <>
              <option value="">All categories</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.OPEN}>{SEAT_MATRIX_CATEGORY_LABELS.OPEN}</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.OBC}>{SEAT_MATRIX_CATEGORY_LABELS.OBC}</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.SC}>{SEAT_MATRIX_CATEGORY_LABELS.SC}</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.ST}>{SEAT_MATRIX_CATEGORY_LABELS.ST}</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.EWS}>{SEAT_MATRIX_CATEGORY_LABELS.EWS}</option>
            </>
          ) : (
            <>
              <option value="">Open & OBC (both)</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.OPEN}>{SEAT_MATRIX_CATEGORY_LABELS.OPEN}</option>
              <option value={SEAT_MATRIX_CATEGORY_PARAM.OBC}>{SEAT_MATRIX_CATEGORY_LABELS.OBC}</option>
            </>
          )}
        </select>
        {source === "mcc" && diffYearOptions.length > 0 && (
          <select name="diffYear" defaultValue={diffYear ? String(diffYear) : ""} className={fieldSelect}>
            <option value="">No year diff</option>
            {diffYearOptions.map((y) => (
              <option key={y} value={y}>
                Diff vs MCC {y}
              </option>
            ))}
          </select>
        )}
        </div>
        <p className="text-sm text-slate-600">
            Seat category:{" "}
            {(
              [
                { label: "Open & OBC", category: "" },
                { label: "Open only", category: SEAT_MATRIX_CATEGORY_PARAM.OPEN },
                { label: "OBC only", category: SEAT_MATRIX_CATEGORY_PARAM.OBC },
              ] as const
            ).map(({ label, category }, i) => {
              const active =
                (category === "" && !categoryParam) ||
                categoryParam === category ||
                (category === SEAT_MATRIX_CATEGORY_PARAM.OPEN && reservationCategory === "GENERAL");
              return (
                <span key={label}>
                  {i > 0 && " · "}
                  {active ? (
                    <span className="font-medium text-slate-900">{label}</span>
                  ) : (
                    <Link
                      href={seatMatrixHref({
                        source: source === "mcc" ? "mcc" : undefined,
                        year: source === "mcc" ? String(matrixYear) : undefined,
                        state: params.state,
                        degree: params.degree,
                        course: selectedCourses.length ? selectedCourses : undefined,
                        quota: params.quota,
                        category: category || undefined,
                        diffYear: diffYear ? String(diffYear) : undefined,
                        q: params.q,
                      })}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}
          </p>
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            Apply filters
          </button>
          {source === "nmc" && (
            <p className="text-xs leading-relaxed text-slate-500">
              NMC = total approved seats. For category breakdown use{" "}
              <strong className="font-medium text-slate-700">MCC counselling matrix</strong>.
            </p>
          )}
        </div>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-slate-600">
          {source === "nmc" ? (
            <>
              Showing <strong>NMC {ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR}</strong> master matrix — total approved intake
              per college & course (not round-wise vacancies).
            </>
          ) : source === "maharashtra" ? (
            <>
              Showing <strong>MAHACET {matrixYear}</strong> Maharashtra state seat matrix — college, course, state
              quota, and reservation category (Open, OBC, SC, ST, EWS, etc.) from official MAHACET data.
              {" "}
              <Link href="/seat-matrix/compare" className="font-medium text-brand-600 hover:underline">
                Compare 2025 vs 2026 →
              </Link>
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
              {" "}
              Only <strong>Open (General)</strong> and <strong>OBC</strong> seats are shown — not EWS, SC, ST, or PwD.
            </>
          )}
        </p>
        <p className="text-sm text-slate-500">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString("en-IN")} rows ·{" "}
          {collegeCount.length.toLocaleString("en-IN")} colleges ·{" "}
          {(seatSum._sum.seats ?? 0).toLocaleString("en-IN")} seats on this filter
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3.5">College</th>
              <th className="px-4 py-3.5">State</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">Course</th>
              {showQuotaCol && <th className="px-4 py-3.5">Quota</th>}
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">{diffYear ? `Seats ${matrixYear}` : "Seats"}</th>
              {diffYear && <th className="px-4 py-3.5">Seats {diffYear}</th>}
              {diffYear && <th className="px-4 py-3.5">Change</th>}
              {showMaharashtraRanks && (
                <>
                  <th className="px-4 py-3.5">2025 SML close</th>
                  <th className="px-4 py-3.5">AIQ close</th>
                  {profile && <th className="px-4 py-3.5">Your rank Δ</th>}
                </>
              )}
              <th className="w-[108px] px-4 py-3.5">Add</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="p-8 text-center text-slate-500">
                  No seat matrix rows match these filters.
                  {source === "maharashtra" &&
                    matrixYear === ACTIVE_MAH_SEAT_MATRIX_YEAR &&
                    mah2026Stats._count === 0 && (
                    <span className="mt-2 block text-sm">
                      MAHACET {ACTIVE_MAH_SEAT_MATRIX_YEAR} matrix not loaded. Run{" "}
                      <code className="rounded bg-slate-100 px-1">npm run sync:maharashtra-2026-seat-matrix-sheet</code>.
                    </span>
                  )}
                  {source === "maharashtra" && mah2026Stats._count > 0 && total === 0 && (
                    <span className="mt-2 block text-sm">
                      Data is loaded — try clearing category, quota, or branch filters (default shows all categories).
                    </span>
                  )}
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
                      <strong>Open & OBC</strong> (NMC totals are usually General only).
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
                const closeKey = `${row.collegeId}|${row.specialtyId}|${row.category}`;
                const closes = cutoffCloses.get(closeKey);
                const useSml =
                  profile?.rankType === "SML" ||
                  profile?.counsellingPref === "STATE" ||
                  profile?.domicileState === "Maharashtra";
                const refClose = useSml ? closes?.smlClose : closes?.airClose ?? closes?.smlClose;
                const refType = useSml && closes?.smlClose ? "SML" : "AIR";
                const rankDiff =
                  profile && refClose != null ? profile.rank - refClose : null;

                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <Link href={`/colleges/${row.college.slug}`} className="text-brand-600 hover:underline">
                        {displayCollegeName(row.college.shortName || row.college.name)}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{row.college.state}</td>
                    <td className="px-4 py-3.5">
                      <Badge className="border-slate-200 bg-white text-slate-700">
                        {COLLEGE_TYPE_LABELS[row.college.collegeType] ?? row.college.collegeType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      {row.specialty.degree} {row.specialty.name}
                    </td>
                    {showQuotaCol && (
                      <td className="px-4 py-3.5 text-slate-600">{QUOTA_LABELS[row.quota] ?? row.quota}</td>
                    )}
                    <td className="px-4 py-3.5 text-slate-600">
                      {SEAT_MATRIX_CATEGORY_LABELS[row.category] ?? row.category}
                    </td>
                    <td className="px-4 py-3.5 font-medium">{row.seats}</td>
                    {diffYear && (
                      <td className="px-4 py-3.5 text-slate-600">{prevSeats !== undefined ? prevSeats : "—"}</td>
                    )}
                    {diffYear && (
                      <td
                        className={`px-4 py-3.5 font-medium ${
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
                    {showMaharashtraRanks && (
                      <>
                        <td className="px-4 py-3.5 text-slate-700">
                          {closes?.smlClose != null ? formatRank(closes.smlClose, "SML") : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {closes?.airClose != null ? (
                            <>
                              {formatRank(closes.airClose, "AIR")}
                              {closes.airYear === 2026 && (
                                <span className="ml-1 text-[10px] text-amber-700">prov.</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        {profile && (
                          <td
                            className={`px-4 py-3.5 text-xs font-medium ${
                              rankDiff == null
                                ? "text-slate-400"
                                : rankDiff <= 0
                                  ? "text-emerald-700"
                                  : "text-red-600"
                            }`}
                          >
                            {rankDiff == null || refClose == null
                              ? "—"
                              : `${rankDiff <= 0 ? "+" : "−"}${Math.abs(rankDiff).toLocaleString("en-IN")} vs ${refType}`}
                          </td>
                        )}
                      </>
                    )}
                    <td className="px-4 py-3.5">
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
        {source === "mcc"
          ? MCC_SEAT_MATRIX_SOURCE_NOTE
          : source === "maharashtra"
            ? MAH_SEAT_MATRIX_SOURCE_NOTE
            : SEAT_MATRIX_SOURCE_NOTE}
      </p>
    </div>
  );
}
