import Link from "next/link";
import { guidesByCategory, TOP_COLLEGES_DISCLAIMER } from "@medcounsel/types";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Award, MapPin, Stethoscope } from "lucide-react";

const CATEGORY_META = {
  overall: {
    title: "Overall picks",
    icon: Award,
    desc: "Broad reputation + cutoff strength",
  },
  region: {
    title: "By city / region",
    icon: MapPin,
    desc: "Mumbai, Pune, Nagpur & more",
  },
  branch: {
    title: "By branch / specialty",
    icon: Stethoscope,
    desc: "Best for Radiodiagnosis, Medicine, Surgery…",
  },
} as const;

export default function TopCollegesPage() {
  return (
    <div className="page">
      <PageHeader
        kicker="College guides"
        title="Top Colleges — pick easier"
        description="Curated lists like Reddit senior reviews — which colleges are famous for which branch, with cutoff context from official MCC data where available."
      />

      <DisclaimerBanner compact />
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {TOP_COLLEGES_DISCLAIMER}
      </p>

      {(["overall", "region", "branch"] as const).map((cat) => {
        const guides = guidesByCategory(cat);
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">{meta.title}</h2>
                <p className="text-sm text-slate-500">{meta.desc}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((g) => (
                <Link
                  key={g.slug}
                  href={`/top-colleges/${g.slug}`}
                  className="card card-tile transition-shadow hover:shadow-md"
                >
                  <p className="font-medium text-brand-700">{g.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{g.description}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {g.entries.length} colleges listed
                    {g.specialtyLabel ? ` · ${g.specialtyLabel}` : ""}
                    {g.region ? ` · ${g.region}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">How to use this</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Pick your branch guide first (e.g. Radiodiagnosis) to see community favourites.</li>
          <li>Click a college to see fees, stipend, bonds, and year-wise cutoffs.</li>
          <li>Cross-check with <Link href="/my-chances" className="text-brand-600 hover:underline">My Chances</Link> for your rank.</li>
        </ul>
      </div>
    </div>
  );
}
