import { Badge } from "@/components/ui/badge";
import { getDataStats } from "@/lib/data-stats";

export async function DataStatsBanner() {
  const stats = await getDataStats();

  return (
    <div className="card flex flex-wrap items-center gap-3 border-emerald-200 bg-emerald-50/60 p-4">
      <Badge className="bg-emerald-100 text-emerald-900">OFFICIAL MCC DATA</Badge>
      <p className="text-sm text-emerald-900">
        <span className="font-semibold">{stats.totalVerifiedCutoffs.toLocaleString("en-IN")}</span> verified cutoffs
        {" · "}
        <span className="font-semibold">{stats.aiqCutoffs.toLocaleString("en-IN")}</span> AIQ (AIR)
        {stats.aiqYearRange && (
          <>
            {" · "}
            <span className="font-semibold">
              {stats.aiqYearRange.min}–{stats.aiqYearRange.max}
            </span>{" "}
            ({stats.aiqYearRange.count} years)
          </>
        )}
        {" · "}
        <span className="font-semibold">{stats.mahCutoffs.toLocaleString("en-IN")}</span> Maharashtra (SML)
        {" · "}
        <span className="font-semibold">{stats.neetPgColleges.toLocaleString("en-IN")}</span> NEET-PG institutes
        {" · "}
        <span className="font-semibold">{stats.officialColleges.toLocaleString("en-IN")}</span> total colleges
      </p>
      <p className="text-xs text-emerald-700">
        Sourced from{" "}
        <a href="https://mcc.nic.in/pg-medical-counselling/" className="underline" target="_blank" rel="noreferrer">
          mcc.nic.in
        </a>
        {stats.mccSources > 0 && <> · {stats.mccSources} official PDFs indexed</>}
        {stats.lastImport && (
          <>
            {" · "}
            Updated {stats.lastImport.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </>
        )}
      </p>
    </div>
  );
}
