import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  aggregateCompareByBranch,
  aggregateCompareByCollege,
  compareMaharashtraSeatMatrices,
} from "@/lib/maharashtra-seat-matrix-compare";
import { Badge } from "@/components/ui/badge";
import { fieldInput, fieldSelect, sectionCard, sectionTitle } from "@/lib/form-field-classes";

const STATUS_LABELS: Record<string, string> = {
  increased: "Increased",
  decreased: "Decreased",
  unchanged: "Unchanged",
  new: "New in 2026",
  removed: "Removed in 2026",
  needs_review: "Needs review",
};

export default async function SeatMatrixComparePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; college?: string; branch?: string; category?: string }>;
}) {
  const params = await searchParams;
  const data = compareMaharashtraSeatMatrices(2025, 2026, "seat_matrix_r1_govt");

  if (!data) {
    return (
      <div className="page">
        <PageHeader title="Maharashtra seat matrix: 2025 vs 2026" />
        <p className="text-slate-600">
          2025 or 2026 government seat matrix JSON is missing on this server. Import{" "}
          <code>data/maharashtra/2026/processed/seat_matrix_r1_govt.json</code> and redeploy.
        </p>
        <Link href="/seat-matrix" className="text-brand-600 hover:underline">
          ← Back to seat matrix
        </Link>
      </div>
    );
  }

  const { summary } = data;
  let rows = data.rows;
  const collegeTotals = aggregateCompareByCollege(data.rows);
  const branchTotals = aggregateCompareByBranch(data.rows);
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  if (params.college)
    rows = rows.filter((r) => r.college.toLowerCase().includes(params.college!.toLowerCase()));
  if (params.branch)
    rows = rows.filter((r) => r.branch.toLowerCase().includes(params.branch!.toLowerCase()));
  if (params.category) rows = rows.filter((r) => r.category === params.category);

  const display = rows.slice(0, 200);

  return (
    <div className="page space-y-6">
      <PageHeader
        title="Maharashtra seat matrix: 2025 vs 2026"
        description="Official R1 government / corporation matrix — seat changes only from verified PDF imports."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/seat-matrix" className="text-brand-600 hover:underline">
              ← PG seat matrix
            </Link>
            <a
              href="/api/maharashtra/seat-matrix/compare?format=csv"
              className="font-medium text-brand-600 hover:underline"
            >
              Export CSV
            </a>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={sectionCard}>
          <p className="text-xs text-slate-500">Total seats 2025</p>
          <p className="text-2xl font-semibold">{summary.totalSeatsA.toLocaleString("en-IN")}</p>
        </div>
        <div className={sectionCard}>
          <p className="text-xs text-slate-500">Total seats 2026</p>
          <p className="text-2xl font-semibold">{summary.totalSeatsB.toLocaleString("en-IN")}</p>
        </div>
        <div className={sectionCard}>
          <p className="text-xs text-slate-500">Net change</p>
          <p
            className={`text-2xl font-semibold ${summary.netChange >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            {summary.netChange >= 0 ? "+" : ""}
            {summary.netChange.toLocaleString("en-IN")}
          </p>
        </div>
        <div className={sectionCard}>
          <p className="text-xs text-slate-500">Colleges ↑ / ↓</p>
          <p className="text-lg font-medium">
            {summary.collegesIncreased} / {summary.collegesDecreased}
          </p>
          <p className="text-xs text-slate-500">
            New {summary.collegesNew} · Removed {summary.collegesRemoved}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={sectionCard}>
          <p className={sectionTitle}>College totals (govt R1)</p>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="pb-1">College</th>
                  <th className="pb-1 text-right">2025</th>
                  <th className="pb-1 text-right">2026</th>
                  <th className="pb-1 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {collegeTotals.slice(0, 15).map((c) => (
                  <tr key={c.collegeKey} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{c.college}</td>
                    <td className="py-1 text-right">{c.seatsA}</td>
                    <td className="py-1 text-right">{c.seatsB}</td>
                    <td
                      className={`py-1 text-right font-medium ${c.change > 0 ? "text-emerald-700" : c.change < 0 ? "text-red-700" : ""}`}
                    >
                      {c.change > 0 ? `+${c.change}` : c.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={sectionCard}>
          <p className={sectionTitle}>Branch totals</p>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="pb-1">Branch</th>
                  <th className="pb-1 text-right">2025</th>
                  <th className="pb-1 text-right">2026</th>
                  <th className="pb-1 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {branchTotals.slice(0, 15).map((b) => (
                  <tr key={b.branchKey} className="border-t border-slate-100">
                    <td className="py-1 pr-2">
                      {b.degree} {b.branch}
                    </td>
                    <td className="py-1 text-right">{b.seatsA}</td>
                    <td className="py-1 text-right">{b.seatsB}</td>
                    <td
                      className={`py-1 text-right font-medium ${b.change > 0 ? "text-emerald-700" : b.change < 0 ? "text-red-700" : ""}`}
                    >
                      {b.change > 0 ? `+${b.change}` : b.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <form className={`${sectionCard} flex flex-wrap gap-3`} method="get">
        <select name="status" className={fieldSelect} defaultValue={params.status ?? ""}>
          <option value="">All change types</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="college" placeholder="College search" className={fieldInput} defaultValue={params.college ?? ""} />
        <input name="branch" placeholder="Branch search" className={fieldInput} defaultValue={params.branch ?? ""} />
        <input name="category" placeholder="Category e.g. OBC" className={fieldInput} defaultValue={params.category ?? ""} />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="p-2">College</th>
              <th className="p-2">Branch</th>
              <th className="p-2">Cat.</th>
              <th className="p-2">Quota</th>
              <th className="p-2 text-right">2025</th>
              <th className="p-2 text-right">2026</th>
              <th className="p-2 text-right">Change</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {display.map((r) => (
              <tr key={`${r.collegeKey}-${r.branchKey}-${r.category}-${r.quota}`} className="border-t">
                <td className="p-2 max-w-[200px]">{r.college}</td>
                <td className="p-2">
                  {r.degree} {r.branch}
                </td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{r.quota}</td>
                <td className="p-2 text-right">{r.seats2025 ?? "—"}</td>
                <td className="p-2 text-right">{r.seats2026 ?? "—"}</td>
                <td
                  className={`p-2 text-right font-medium ${
                    (r.change ?? 0) > 0 ? "text-emerald-700" : (r.change ?? 0) < 0 ? "text-red-700" : ""
                  }`}
                >
                  {r.change == null ? "—" : r.change > 0 ? `+${r.change}` : r.change}
                </td>
                <td className="p-2">
                  <Badge className="bg-slate-100">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 200 && (
        <p className="text-xs text-slate-500">Showing first 200 of {rows.length} rows. Use filters or API export.</p>
      )}
      <p className="text-xs text-slate-500">
        Source 2026: official MAHACET Google Sheet (govt/corporation matrix). College names normalized (e.g. Topiwala
        National Medical College). Missing matched keys are not counted as zero seats.
      </p>
    </div>
  );
}
