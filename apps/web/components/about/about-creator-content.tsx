import { Briefcase, MapPin } from "lucide-react";
import { CREATOR, CREATOR_DISCLAIMER } from "@/lib/creator";
import { CreatorCard } from "@/components/about/creator-card";

const { builtFor } = CREATOR;
import { LinkedInButton } from "@/components/about/linkedin-button";
import { WhyBuiltSection } from "@/components/about/why-built-section";

export function AboutCreatorContent() {
  return (
    <div className="page">
      <section className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">About the creator</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Built by {CREATOR.name}</h2>
        <p className="mt-1 text-sm font-medium text-slate-700">{CREATOR.headline}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Briefcase className="h-3.5 w-3.5" />
          {CREATOR.work}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          {CREATOR.location}
        </p>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            MedCounsel started as a personal project to make NEET-PG counselling easier to
            understand and more organized for {builtFor} while she went through the counselling
            process.
          </p>
          <p>
            What began as something I built for {builtFor} became a platform designed to help
            NEET-PG aspirants make better, more informed counselling decisions.
          </p>
        </div>

        <div className="mt-5">
          <LinkedInButton />
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-sm font-semibold text-slate-900">Background</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          By day I&apos;m a software developer at Persistent Systems, working in cloud and
          DevSecOps-oriented engineering. MedCounsel is a personal project I built on my own time
          to solve a real problem I saw up close—it is not affiliated with Persistent Systems or
          any counselling authority.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CREATOR.credentials.map((item) => (
            <li
              key={item}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          I am not a doctor, NEET-PG counsellor, or official counselling authority. I am the
          developer behind this platform.
        </p>
      </section>

      <WhyBuiltSection />

      <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        {CREATOR_DISCLAIMER}
      </section>

      <CreatorCard compact />
    </div>
  );
}
