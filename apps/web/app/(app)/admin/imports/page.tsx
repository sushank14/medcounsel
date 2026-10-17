import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";
import { getDataStats } from "@/lib/data-stats";
import { ImportTrigger } from "@/components/admin/import-trigger";

export default async function AdminImportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const stats = await getDataStats();

  const imports = await prisma.dataImport.findMany({
    include: { adminUser: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="page">
      <div>
        <BackLink fallbackHref="/admin" />
        <h1 className="mt-2 text-2xl font-bold">Data Import Pipeline</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4">
          <p className="text-xs text-slate-500">AIQ cutoffs (AIR)</p>
          <p className="text-2xl font-bold">{stats.aiqCutoffs.toLocaleString("en-IN")}</p>
          {stats.aiqYearRange && (
            <p className="mt-1 text-xs text-slate-400">
              {stats.aiqYearRange.min}–{stats.aiqYearRange.max} · {stats.aiqYearRange.count} years
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Maharashtra cutoffs (SML)</p>
          <p className="text-2xl font-bold">{stats.mahCutoffs.toLocaleString("en-IN")}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Official colleges</p>
          <p className="text-2xl font-bold">{stats.officialColleges.toLocaleString("en-IN")}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">NEET-PG institutes (MCC)</p>
          <p className="text-2xl font-bold">{stats.neetPgColleges.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-slate-400">AIQ + Deemed + DNB + Central</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">MCC source PDFs</p>
          <p className="text-2xl font-bold">{stats.mccSources.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-slate-400">Allotment + seat matrix</p>
        </div>
        {stats.seatMatrixYear && (
          <div className="card p-4 sm:col-span-2 lg:col-span-5">
            <p className="text-xs text-slate-500">NMC PG Seat Matrix {stats.seatMatrixAcademicYear}</p>
            <p className="text-2xl font-bold">{stats.seatMatrixTotalSeats.toLocaleString("en-IN")} seats</p>
            <p className="mt-1 text-xs text-slate-400">
              {stats.seatMatrixColleges.toLocaleString("en-IN")} colleges ·{" "}
              {stats.seatMatrixRows.toLocaleString("en-IN")} course rows · dated 29 Sep 2026
            </p>
          </div>
        )}
      </div>

      <ImportTrigger />

      <div className="card p-5">
        <h2 className="mb-2 font-semibold">NMC PG Seat Matrix (2026–27)</h2>
        <pre className="rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`python3 packages/data-ingestion/scripts/parse-nmc-seat-matrix.py /path/to/nmc-matrix.pdf
npm run import:nmc-seat-matrix-2026   # Import parsed JSON into database`}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Requires pymupdf for PDF parsing. Parsed JSON is stored in data/processed/nmc/.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 font-semibold">MCC All India Quota (2020–2025)</h2>
        <pre className="rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`npm run fetch:mcc              # Download allotment PDFs from mcc.nic.in
npm run import:mcc             # Parse & import AIQ cutoffs (AIR ranks)
npm run import:neetpg-all      # Import ALL NEET-PG colleges from seat matrices`}
        </pre>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 font-semibold">Maharashtra State Counselling (2025)</h2>
        <pre className="rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`npm run fetch:maharashtra    # Download MAHACET selection lists
npm run import:maharashtra   # Parse & import SML cutoffs`}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Maharashtra uses SML (State Merit List) ranks — never mixed with AIR without explicit labels.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="p-3">Format</th>
              <th className="p-3">Status</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {imports.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-slate-400">No imports yet</td></tr>
            ) : (
              imports.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-3">{i.format}</td>
                  <td className="p-3"><Badge>{i.status}</Badge></td>
                  <td className="p-3">{i.adminUser.email}</td>
                  <td className="p-3">{i.createdAt.toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
