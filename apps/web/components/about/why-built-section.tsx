import { CREATOR } from "@/lib/creator";

export function WhyBuiltSection() {
  return (
    <details className="group card open:shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 font-medium text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Why I built MedCounsel
          <span className="text-xs font-normal text-slate-400 transition group-open:rotate-180">▼</span>
        </span>
      </summary>
      <div className="space-y-3 border-t px-5 py-4 text-sm leading-relaxed text-slate-600">
        <p>
          NEET-PG counselling can involve a huge amount of information—ranks, colleges, courses,
          seat matrices, counselling rounds, state rules and choice filling.
        </p>
        <p>
          I started building MedCounsel while helping {CREATOR.builtFor} navigate this process.
        </p>
        <p>
          As a software engineer, I wanted to turn that information into something simpler: a
          platform that helps candidates understand their options and make their own counselling
          decisions with better information.
        </p>
      </div>
    </details>
  );
}
