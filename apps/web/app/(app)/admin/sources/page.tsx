import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-access";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";

export default async function AdminSourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!canAccessAdmin(user?.role)) redirect("/dashboard");

  const sources = await prisma.source.findMany({
    orderBy: { lastVerifiedDate: "desc" },
    take: 50,
  });

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Sources</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      <div className="space-y-3">
        {sources.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-slate-500">{s.authority} · {s.dataYear}</p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-800">{s.trustLevel}</Badge>
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                {s.url}
              </a>
            )}
            {s.lastVerifiedDate && (
              <p className="mt-1 text-xs text-slate-400">
                Last verified {s.lastVerifiedDate.toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
