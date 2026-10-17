import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { AboutMedCounselContent } from "@/components/about/about-medcounsel-content";

export default async function AboutMedCounselPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl page">
      <BackLink fallbackHref="/profile" label="← Back to profile" />
      <div>
        <h1 className="text-2xl font-bold">About MedCounsel</h1>
        <p className="mt-1 text-sm text-slate-600">
          A personal project for NEET-PG counselling decision support.
        </p>
      </div>
      <AboutMedCounselContent />
    </div>
  );
}
