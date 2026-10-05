import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { AboutCreatorContent } from "@/components/about/about-creator-content";

export default async function AboutCreatorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink fallbackHref="/profile" label="← Back to profile" />
      <AboutCreatorContent />
    </div>
  );
}
