import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@medcounsel/database";
import { QuickProfileForm } from "@/components/home/quick-profile-form";
import { CollegeSearchBar, HomeQuickLinks } from "@/components/home/college-search-bar";
import { CounsellingUpdatesPanel } from "@/components/counselling/counselling-updates-panel";
import { DataStatsBanner } from "@/components/layout/data-stats-banner";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (profile) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <section className="text-center sm:text-left">
        <p className="text-sm font-medium text-brand-600">NEET-PG Counselling</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Hi{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Enter your rank once, search any college, and see what&apos;s realistic for AIQ and Maharashtra counselling.
        </p>
      </section>

      <QuickProfileForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Search colleges</h2>
        <CollegeSearchBar />
        <p className="text-xs text-slate-500">
          Tip: try &quot;Medical College&quot;, a city name, or institute name from your MCC choice list.
        </p>
      </section>

      <HomeQuickLinks />

      <CounsellingUpdatesPanel compact />

      <DataStatsBanner />
      <DisclaimerBanner compact />

      <p className="text-center text-sm text-slate-500">
        Detailed dashboard with calendar &nbsp;·&nbsp;
        <Link href="/dashboard" className="text-brand-600 hover:underline">Open dashboard →</Link>
      </p>
    </div>
  );
}
