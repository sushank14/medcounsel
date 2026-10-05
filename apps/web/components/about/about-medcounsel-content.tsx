import Link from "next/link";
import { CREATOR_DISCLAIMER } from "@/lib/creator";
import { CreatorCard } from "@/components/about/creator-card";
import { WhyBuiltSection } from "@/components/about/why-built-section";

export function AboutMedCounselContent() {
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">What is MedCounsel?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          MedCounsel is a personal project built to simplify the NEET-PG counselling journey by
          bringing together rank analysis, college discovery, counselling information, seat data and
          choice-list planning in one place.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          It is counselling decision support—not a medical consultancy. Predictions and suggestions
          are based on available historical data and should always be verified with official
          authorities.
        </p>
      </section>

      <WhyBuiltSection />

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">What you can do here</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>Explore admission chances based on your rank and category</li>
          <li>Search and compare colleges, fees, and cutoffs</li>
          <li>Plan and optimize your MCC choice list</li>
          <li>Track counselling calendars and document checklists</li>
        </ul>
        <p className="mt-4 text-sm">
          <Link href="/disclaimer" className="font-medium text-brand-600 hover:underline">
            Read full disclaimer & legal
          </Link>
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        {CREATOR_DISCLAIMER}
      </section>

      <p className="text-center text-xs text-slate-400">Built with modern web technologies.</p>

      <CreatorCard />
    </div>
  );
}
