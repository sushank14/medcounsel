import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { CompareWorkspace } from "@/components/compare/compare-workspace";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { PageHeader } from "@/components/layout/page-header";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; s?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const initialItems: Array<{ collegeId: string; specialtyId: string }> = [];

  if (params.c && params.s) {
    initialItems.push({ collegeId: params.c, specialtyId: params.s });
  }

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  return (
    <div className="page">
      <PageHeader
        title="Compare colleges"
        description="Side-by-side comparison of up to 3 college + course options. Only fields with reliable data are shown."
      />

      <DisclaimerBanner compact />

      <CompareWorkspace initialItems={initialItems} hasProfile={!!profile} />

      <p className="text-sm text-slate-500">
        Tip: use &quot;Compare&quot; on any option card in{" "}
        <Link href="/my-chances" className="text-brand-600 hover:underline">
          My Chances
        </Link>
        .
      </p>
    </div>
  );
}
