import Link from "next/link";
import { prisma } from "@medcounsel/database";
import {
  ACTIVE_MCC_SEAT_MATRIX_YEAR,
  ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR,
  ACTIVE_SEAT_MATRIX_YEAR,
  COLLEGE_TYPE_LABELS,
  displayCollegeName,
  INDIAN_STATES,
  MCC_SEAT_MATRIX_SOURCE_NOTE,
  SEAT_MATRIX_SOURCE_NOTE,
} from "@medcounsel/types";
import { Badge } from "@/components/ui/badge";
import { seatMatrixHref } from "@/lib/seat-matrix-nav";

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
    quota?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const source = params.source === "mcc" ? "mcc" : "nmc";
  const matrixYear =
    source === "nmc"
      ? ACTIVE_SEAT_MATRIX_YEAR
      : parseInt(params.year ?? String(ACTIVE_MCC_SEAT_MATRIX_YEAR), 10) || ACTIVE_MCC_SEAT_MATRIX_YEAR;

  const nmcSourceWhere = { title: { contains: "NMC/MARB PG Seat Matrix" } };
  const mccSourceWhere = { title: { contains: "MCC NEET-PG official seat matrix" } };

  const where = {
    year: matrixYear,
    source: source === "mcc" ? mccSourceWhere : nmcSourceWhere,
    ...(params.quota ? { quota: params.quota as never } : {}),
    ...(params.degree ? { specialty: { degree: params.degree as never } } : {}),
    college: {
      ...(params.state ? { state: params.state } : {}),
      ...(params.q ? { name: { contains: params.q } } : {}),
    },
  };

  const [total, rows, seatSum, collegeCount, nmcStats, mcc2026Stats, mcc2025Stats, mcc2024Stats] =
    await Promise.all([
    prisma.seatMatrix.count({ where }),
    prisma.seatMatrix.findMany({
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      where,
      include: {
        college: { select: { slug: true, name: true, shortName: true, state: true, collegeType: true } },
        specialty: { select: { name: true, degree: true } },
      },
      orderBy: [{ college: { state: "asc" } }, { college: { name: "asc" } }, { specialty: { degree: "asc" } }],
    }),
    prisma.seatMatrix.aggregate({ where, _sum: { seats: true } }),
    prisma.seatMatrix.groupBy({ by: ["collegeId"], where }),
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterParams = {
    source: source === "mcc" ? "mcc" : undefined,
    year: source === "mcc" ? String(matrixYear) : undefined,
    state: params.state,
    degree: params.degree,
    quota: params.quota,
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
        {source === "mcc" && <input type="hidden" name="source" value="mcc" />}
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
          <option value="">All degrees</option>
          {["MD", "MS", "DNB", "DIPLOMA"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
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
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {source === "nmc" ? (
            <>
              Showing <strong>NMC {ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR}</strong> master matrix — total approved intake
              per college & course (not round-wise vacancies).
            </>
          ) : (
            <>
              Showing <strong>MCC NEET-PG {matrixYear}</strong> counselling seat matrix — quota-wise seats offered
              in MCC counselling.
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
              <th className="p-3">Seats</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={source === "mcc" ? 6 : 5} className="p-8 text-center text-slate-500">
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
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                  <td className="p-3 font-medium">{row.seats}</td>
                </tr>
              ))
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
