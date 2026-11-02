import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { PageHeader } from "@/components/layout/page-header";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { AirSmlExplorer } from "@/components/maharashtra/air-sml-explorer";
import { loadMaharashtraAirSmlIndex, loadMeritIndexMeta } from "@/lib/maharashtra-air-sml-index";

export default async function MaharashtraRankMapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  const airIndex = loadMaharashtraAirSmlIndex();
  const meritLists = loadMeritIndexMeta();

  return (
    <div className="page">
      <PageHeader
        kicker="Maharashtra state counselling"
        title="AIR ↔ SML rank map"
        description="Verified mapping from official CET registered-candidate lists. SML is used for Maharashtra CAP; AIR is used for MCC AIQ — never mix them in choice filling."
      />

      <DisclaimerBanner compact />

      <section className="card card-body text-sm text-slate-600">
        <p>
          Data source:{" "}
          {airIndex ? (
            <a href={airIndex.sourceUrl} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
              {airIndex.year} {airIndex.listLabel} ({airIndex.totalRows.toLocaleString("en-IN")} candidates)
            </a>
          ) : (
            <span className="text-amber-700">Index not imported on this server yet.</span>
          )}
        </p>
        {meritLists.length > 0 && (
          <p className="mt-2">
            Merit list indexes loaded:{" "}
            {meritLists.map((m) => `${m.year} ${m.round} (${m.totalRows.toLocaleString("en-IN")})`).join(" · ")}
          </p>
        )}
        <p className="mt-2">
          Use your <strong>NEET PG roll number</strong> on the{" "}
          <Link href="/counselling" className="text-brand-600 hover:underline">
            Counselling Hub
          </Link>{" "}
          for exact SML from merit PDFs. Use this page when you only know your AIR.
        </p>
      </section>

      <AirSmlExplorer
        initialAir={profile?.rankType === "AIR" ? profile.rank : undefined}
        initialCategory={profile?.category}
      />

      <section className="card card-body section-block">
        <h2 className="text-lg font-semibold">Sample verified AIR → SML (2025 reg-cap3)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Illustrative lookups from imported data — your rank may differ if you registered in a different list
          round.
        </p>
        <SampleTable />
      </section>
    </div>
  );
}

async function SampleTable() {
  const samples = [5_000, 10_000, 15_197, 20_000];
  const { lookupByAir } = await import("@/lib/maharashtra-air-sml-index");

  const rows = samples.map((sampleAir) => {
    const r = lookupByAir(sampleAir);
    return { sampleAir, ...r };
  });

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-2">NEET AIR</th>
            <th className="p-2">Maharashtra SML</th>
            <th className="p-2">Category</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sampleAir} className="border-b border-slate-100">
              <td className="p-2 font-mono">{row.sampleAir.toLocaleString("en-IN")}</td>
              <td className="p-2 font-mono">
                {row.smlRank > 0 ? row.smlRank.toLocaleString("en-IN") : "—"}
              </td>
              <td className="p-2">{row.data?.category ?? "—"}</td>
              <td className="p-2">
                {row.found ? (
                  <span className="text-emerald-700">Exact (published)</span>
                ) : row.estimated && row.smlRank > 0 ? (
                  <span className="text-amber-700">Estimated (interpolated)</span>
                ) : (
                  <span className="text-slate-400">Unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
