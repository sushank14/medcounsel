import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { getMaharashtra2025Readiness } from "@/lib/maharashtra-data-readiness";
import fs from "fs";
import path from "path";

type AuditRow = {
  document_key?: string;
  extraction_status?: string;
  rows_extracted?: number;
  rows_verified?: number;
  rows_rejected?: number;
};

function loadJson<T>(rel: string): T | null {
  const candidates = [
    path.join(process.cwd(), "../../data/maharashtra/2025/processed", rel),
    path.join(process.cwd(), "../../data/processed/maharashtra", rel),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function loadValidation(): { audits?: AuditRow[]; candidate_history_count?: number } | null {
  const candidates = [
    path.join(process.cwd(), "../../data/maharashtra/2025/processed/validation_report.json"),
    path.join(process.cwd(), "../../data/processed/maharashtra/validation_report.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      /* ignore */
    }
  }
  return null;
}

export default async function AdminMaharashtraPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const validation = loadValidation();
  const audits = validation?.audits ?? [];
  const history = loadJson<{ candidate_count?: number }>("candidate_allotment_history.json");
  const r2diff = loadJson<{ changes_count?: number }>("matrix_compare_r2_original_vs_updated.json");
  const dbValidation = loadJson<{ allOk?: boolean; verifiedCutoffs?: number }>("db_validation_report.json");
  const readiness = await getMaharashtra2025Readiness();

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Maharashtra 2025 Pipeline</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span
          className={`rounded px-2 py-1 ${readiness.predictionReady ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
        >
          Predictions: {readiness.predictionReady ? "MAH 2025 DB ready" : "blocked until DB validated"}
        </span>
        {readiness.counts?.cutoffsVerified != null && (
          <span className="rounded bg-slate-100 px-2 py-1">
            Verified cutoffs in DB: {readiness.counts.cutoffsVerified}
          </span>
        )}
        {dbValidation?.allOk != null && (
          <span className="rounded bg-slate-100 px-2 py-1">
            Last DB validation: {dbValidation.allOk ? "passed" : "failed"}
          </span>
        )}
        {history?.candidate_count != null && (
          <span className="rounded bg-slate-100 px-2 py-1">Candidates tracked: {history.candidate_count}</span>
        )}
        {r2diff?.changes_count != null && (
          <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">
            R2 matrix changes (orig→updated): {r2diff.changes_count}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Run locally:{" "}
        <code className="rounded bg-slate-100 px-1">npm run maharashtra-2025:db</code> (pipeline → import → validate)
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-2 pr-4">Document</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Extracted</th>
              <th className="py-2 pr-4">Verified</th>
              <th className="py-2">Review</th>
            </tr>
          </thead>
          <tbody>
            {audits.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-slate-500">
                  No validation report yet. Run the pipeline to generate{" "}
                  <code>data/maharashtra/2025/processed/validation_report.json</code>.
                </td>
              </tr>
            ) : (
              audits.map((a) => (
                <tr key={a.document_key} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs">{a.document_key}</td>
                  <td className="py-2 pr-4">{a.extraction_status}</td>
                  <td className="py-2 pr-4">{a.rows_extracted ?? "—"}</td>
                  <td className="py-2 pr-4">{a.rows_verified ?? "—"}</td>
                  <td className="py-2">{a.rows_rejected ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        JSON API: <code>/api/admin/maharashtra/pipeline</code>. Only verified rows should drive predictions by default.
      </p>
    </div>
  );
}
