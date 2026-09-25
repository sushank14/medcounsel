import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { displayCollegeName, formatCollegeLocation } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";
import type { ResolvedCuratedEntry } from "@/lib/top-colleges";
import { competitiveLabel } from "@/lib/top-colleges";
import { MessageCircle } from "lucide-react";

export function CuratedCollegeCard({
  entry,
  rankType = "AIR",
  showBranch = false,
  branchLabel,
}: {
  entry: ResolvedCuratedEntry;
  rankType?: "AIR" | "SML";
  showBranch?: boolean;
  branchLabel?: string;
}) {
  const college = entry.college;
  const tier = competitiveLabel(entry.medianCutoff, rankType);

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {entry.rank}
        </div>
        <div className="min-w-0 flex-1">
          {college ? (
            <Link
              href={`/colleges/${college.slug}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {displayCollegeName(college.name)}
            </Link>
          ) : (
            <p className="font-semibold text-slate-700">
              {entry.nameKeywords.join(" ")}
              <span className="ml-2 text-xs font-normal text-amber-600">(not found in DB — search manually)</span>
            </p>
          )}
          {college && (
            <p className="text-sm text-slate-500">
              {formatCollegeLocation(college.city, college.state, college.name, college.slug)} · {college.collegeType.replace("_", " ")}
            </p>
          )}
          {showBranch && branchLabel && (
            <p className="mt-1 text-xs text-slate-500">Branch: {branchLabel}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.highlights.map((h) => (
              <Badge key={h} className="bg-slate-100 text-slate-700">
                {h}
              </Badge>
            ))}
            {tier && (
              <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                {tier}
              </Badge>
            )}
            {entry.medianCutoff && (
              <Badge className="border-slate-200 bg-white text-slate-600">
                ~{formatRank(entry.medianCutoff, rankType)} median cutoff
                {entry.cutoffYears ? ` (${entry.cutoffYears} yr)` : ""}
              </Badge>
            )}
          </div>
          {entry.communityTip && (
            <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
              <p>{entry.communityTip}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
