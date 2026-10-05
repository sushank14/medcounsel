import { notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { auth } from "@/lib/auth";
import { generatePredictions } from "@/lib/predictions";
import { Badge } from "@/components/ui/badge";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { CutoffChart } from "@/components/college/cutoff-chart";
import { SourceLink } from "@/components/ui/source-link";
import {
  ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR,
  displayCollegeName,
  formatCollegeLocation,
  isDemoCollege,
} from "@medcounsel/types";
import { formatCurrency, formatRank } from "@/lib/utils";

export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const college = await prisma.college.findUnique({
    where: { slug },
    include: {
      specialties: { include: { specialty: true } },
      fees: true,
      bonds: true,
      stipends: { orderBy: { yearOfTraining: "asc" } },
      cutoffs: {
        include: { specialty: true, round: true, counselling: true },
        orderBy: [{ year: "asc" }, { closingRank: "asc" }],
      },
    },
  });

  if (!college || isDemoCollege(college.slug, college.dataStatus)) notFound();

  let candidateFit = null;
  if (session?.user?.id) {
    const profile = await prisma.candidateProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
    });
    if (profile) {
      const predictions = await generatePredictions({
        rank: profile.rank,
        rankType: profile.rankType as "AIR" | "SML",
        category: profile.category,
        domicileState: profile.domicileState,
        counsellingPref: profile.counsellingPref as "AIQ" | "STATE" | "BOTH",
        collegePref: "ANY",
        budgetRange: "NO_RESTRICTION",
      });
      candidateFit = predictions.filter((p) => p.collegeId === college.id);
    }
  }

  const chartData = college.cutoffs
    .filter((c) => c.category === "GENERAL")
    .slice(0, 20)
    .map((c) => ({
      year: c.year,
      round: c.round?.round ?? "R1",
      closingRank: c.closingRank,
      specialty: c.specialty.name,
    }));

  return (
    <div className="space-y-6">
      <div>
        <BackLink fallbackHref="/colleges" />
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <h1 className="text-2xl font-bold">{displayCollegeName(college.name)}</h1>
        </div>
        <p className="text-slate-600">
          {formatCollegeLocation(college.city, college.state, college.name, college.slug)} · {college.collegeType}
          {college.nmcId && <span className="ml-2 text-slate-400">· MCC #{college.nmcId}</span>}
        </p>
      </div>

      {college.dataStatus === "OFFICIAL" && (
        <SourceLink
          url="https://mcc.nic.in/pg-medical-counselling/"
          title="MCC PG Medical Counselling — official source"
        />
      )}

      <DisclaimerBanner compact />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="font-semibold">Overview</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">University</dt><dd>{college.university ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Established</dt><dd>{college.establishedYear ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Type</dt><dd>{college.collegeType}</dd></div>
            <div><dt className="text-slate-500">Website</dt><dd>{college.website ? <a href={college.website} className="text-brand-600 hover:underline" target="_blank" rel="noopener">Official site</a> : "—"}</dd></div>
          </dl>
        </div>

        {college.fees[0] && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Fees (AY {college.fees[0].academicYear})</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Tuition</dt><dd>{formatCurrency(college.fees[0].tuitionFee)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Hostel</dt><dd>{formatCurrency(college.fees[0].hostelFee)}</dd></div>
              <div className="flex justify-between font-medium"><dt>Total</dt><dd>{formatCurrency(college.fees[0].totalAnnual)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-slate-400">
              {college.fees[0].verifiedAt ? "Verified fee data" : "Estimated — verify with college"}
            </p>
          </div>
        )}
      </div>

      {college.stipends.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Stipend (PG Residents)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Basic</th>
                  <th className="pb-2 pr-4">DA</th>
                  <th className="pb-2 pr-4">Total/month</th>
                  <th className="pb-2">Pay scale</th>
                </tr>
              </thead>
              <tbody>
                {college.stipends.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-4">{s.yearOfTraining}</td>
                    <td className="py-2 pr-4">{formatCurrency(s.monthlyAmount)}</td>
                    <td className="py-2 pr-4">{formatCurrency(s.da)}</td>
                    <td className="py-2 pr-4 font-medium">{formatCurrency(s.totalMonthly)}</td>
                    <td className="py-2 text-slate-500">{s.payScale ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Verify with NMC-mandated college stipend disclosures</p>
        </div>
      )}

      {college.bonds[0] && (
        <div className="card p-5">
          <h2 className="mb-2 font-semibold">Bond & Service</h2>
          <p className="text-sm">{college.bonds[0].serviceObligation}</p>
          {college.bonds[0].bondAmount && (
            <p className="mt-1 text-sm font-medium">Bond amount: {formatCurrency(college.bonds[0].bondAmount)}</p>
          )}
        </div>
      )}

      {college.cutoffs.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Cutoff history not linked yet</p>
          <p className="mt-1 text-amber-800">
            Seat/specialty info may be available, but year-wise closing ranks for this institute are still
            being matched in our database. Check{" "}
            <Link href="/cutoffs" className="font-medium underline">
              Cutoffs explorer
            </Link>{" "}
            or official MCC/Maharashtra PDFs. If the name shows as an abbreviation (e.g. GGMC), we&apos;re
            fixing those links.
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-1 font-semibold">Available Specialties</h2>
        <p className="mb-3 text-xs text-slate-500">
          Seat counts from NMC PG Seat Matrix {ACTIVE_SEAT_MATRIX_ACADEMIC_YEAR} (approved intake for counselling).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 pr-4">Specialty</th>
                <th className="pb-2 pr-4">Degree</th>
                <th className="pb-2 pr-4">Seats</th>
                <th className="pb-2">Recent Closing Rank</th>
              </tr>
            </thead>
            <tbody>
              {college.specialties.map((cs) => {
                const recentCutoff = college.cutoffs
                  .filter((c) => c.specialtyId === cs.specialtyId)
                  .sort((a, b) => b.year - a.year)[0];
                return (
                  <tr key={cs.id} className="border-b">
                    <td className="py-2 pr-4">{cs.specialty.name}</td>
                    <td className="py-2 pr-4">{cs.specialty.degree}</td>
                    <td className="py-2 pr-4">{cs.totalSeats}</td>
                    <td className="py-2">{recentCutoff ? formatRank(recentCutoff.closingRank, recentCutoff.rankType) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Cutoff History</h2>
          <CutoffChart data={chartData} />
        </div>
      )}

      {candidateFit && candidateFit.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Your Historical Position</h2>
          <div className="space-y-3">
            {candidateFit.map((f) => (
              <div key={f.specialtyId} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                <span className="font-medium">{f.degree} {f.specialtyName}</span>
                <Badge>{f.fitLevel}</Badge>
                <span className="text-sm text-slate-500">
                  Your rank: {formatRank(f.candidateRank, f.rankType)} · Median closing: {formatRank(f.statistics.median, f.rankType)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
