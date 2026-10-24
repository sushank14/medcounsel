import Link from "next/link";
import type { PredictionResult } from "@medcounsel/types";
import { CATEGORY_LABELS, COLLEGE_TYPE_LABELS, QUOTA_LABELS } from "@medcounsel/types";
import { FitBadge } from "./fit-badge";
import { formatCurrency, formatRank } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SourceLink } from "@/components/ui/source-link";
import { AddToChoiceButton } from "@/components/preference/add-to-choice-button";
import { AddToCompareButton } from "@/components/compare/add-to-compare-button";

export function PredictionCard({ result, showActions = true }: { result: PredictionResult; showActions?: boolean }) {
  const diffSign = result.candidateDiff <= 0 ? "+" : "";
  const diffAbs = Math.abs(result.candidateDiff);

  const latestRound = result.roundMovement[result.roundMovement.length - 1];

  return (
    <article className="card card-tile transition-shadow hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">
            {result.degree} {result.specialtyName}
          </h3>
          <p className="text-sm text-slate-600">{result.collegeName}</p>
          <p className="text-xs text-slate-400">{result.city}, {result.state}</p>
        </div>
        <FitBadge fitLevel={result.fitLevel} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Badge
          className={
            result.collegeType === "GOVT" || result.collegeType === "CENTRAL"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-orange-50 text-orange-800"
          }
        >
          {COLLEGE_TYPE_LABELS[result.collegeType] ?? result.collegeType.replace("_", " ")}
        </Badge>
        <Badge className="bg-blue-50 text-blue-800">
          {CATEGORY_LABELS[result.category] ?? result.category}
        </Badge>
        <Badge className="bg-indigo-50 text-indigo-800">
          {QUOTA_LABELS[result.quota] ?? result.quota}
        </Badge>
        <Badge className="bg-slate-50">{result.counsellingCode}</Badge>
        {result.seatCount != null && result.seatCount > 0 && (
          <Badge className="bg-violet-50 text-violet-800">{result.seatCount} seats</Badge>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Your rank</p>
          <p className="font-medium">{formatRank(result.candidateRank, result.rankType)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Recent closing</p>
          <p className="font-medium">{formatRank(result.statistics.median, result.rankType)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Difference</p>
          <p className={`font-medium ${result.candidateDiff <= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {diffSign}{diffAbs.toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Confidence</p>
          <Badge className="mt-0.5">{result.confidence}</Badge>
        </div>
      </div>

      {result.yearWiseCutoffs.length > 0 && (
        <div className="mb-3 rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Year-wise closing ranks — best closing across all rounds per year
          </p>
          <div className="flex flex-wrap gap-3">
            {result.yearWiseCutoffs.map((y) => (
              <div key={`${y.year}-${y.round}`} className="text-xs">
                <span className="text-slate-500">
                  {y.year}
                  {y.year === 2026 && y.round === "R1" && (
                    <span className="ml-0.5 text-amber-700" title="MCC provisional Round 1 allotment">
                      (prov.)
                    </span>
                  )}
                  {y.round !== "R1" && (
                    <span className="ml-0.5 text-slate-400">({y.round.replace("_", " ")})</span>
                  )}
                  :
                </span>{" "}
                <span className="font-medium">{formatRank(y.closingRank, result.rankType)}</span>
              </div>
            ))}
          </div>
          {result.yearTrend.trend !== "INSUFFICIENT_DATA" && (
            <p className="mt-2 text-xs text-slate-500">
              Trend: {result.yearTrend.trend.toLowerCase().replace("_", " ")} — {result.yearTrend.trendDescription}
              {result.yearTrend.projectedRange && (
                <>
                  {" "}
                  · Projected {formatRank(result.yearTrend.projectedRange.min, result.rankType)}–
                  {formatRank(result.yearTrend.projectedRange.max, result.rankType)}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {latestRound && result.roundMovement.length > 1 && (
        <div className="mb-3 rounded-lg bg-blue-50/60 p-2 text-xs text-blue-900">
          Latest round ({latestRound.year} {latestRound.round}): closing{" "}
          {formatRank(latestRound.closingRank, result.rankType)}
          {latestRound.round === "STRAY" && " — stray vacancies often have relaxed cutoffs"}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {result.fees && (
          <Badge className="bg-slate-50">
            {formatCurrency(result.fees.totalAnnual)}/yr
            {result.fees.isEstimate && " (est.)"}
          </Badge>
        )}
        {result.stipend && (
          <Badge className="bg-emerald-50 text-emerald-800">
            Stipend {formatCurrency(result.stipend.totalMonthly)}/mo
          </Badge>
        )}
        {result.bond?.bondAmount && (
          <Badge className="bg-orange-50 text-orange-800">Bond {formatCurrency(result.bond.bondAmount)}</Badge>
        )}
        {result.dataStatus === "OFFICIAL" && (
          <Badge className="bg-emerald-50 text-emerald-800">OFFICIAL MCC</Badge>
        )}
      </div>

      <p className="mb-2 text-xs text-slate-500">{result.confidenceReason}</p>

      {result.sourceUrl && (
        <div className="mb-3">
          <SourceLink url={result.sourceUrl} title={result.sourceTitle} compact />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/colleges/${result.collegeSlug}`} className="text-sm font-medium text-brand-600 hover:underline">
          View details →
        </Link>
        {showActions && (
          <>
            <AddToChoiceButton
              collegeId={result.collegeId}
              specialtyId={result.specialtyId}
              compact
              fitSnapshot={{
                fitLevel: result.fitLevel,
                candidateRank: result.candidateRank,
                medianClosing: result.statistics.median,
                tier: result.fitLevel,
              }}
            />
            <AddToCompareButton collegeId={result.collegeId} specialtyId={result.specialtyId} compact />
          </>
        )}
      </div>
    </article>
  );
}
