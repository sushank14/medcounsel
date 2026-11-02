import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-access";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!canAccessAdmin(user?.role)) redirect("/dashboard");

  const [colleges, cutoffs, stipends, imports, sources] = await Promise.all([
    prisma.college.count(),
    prisma.cutoff.count(),
    prisma.stipend.count(),
    prisma.dataImport.count(),
    prisma.source.count(),
  ]);

  const pendingCutoffs = await prisma.cutoff.count({ where: { verificationStatus: "PENDING" } });
  const officialColleges = await prisma.college.count({
    where: { dataStatus: "OFFICIAL", NOT: [{ slug: { startsWith: "demo-" } }] },
  });

  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-slate-600">Data management and freshness overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Colleges", value: colleges, href: "/admin/colleges" },
          { label: "Cutoffs", value: cutoffs, href: "/admin/cutoffs" },
          { label: "Stipends", value: stipends, href: "/admin/stipends" },
          { label: "Sources", value: sources, href: "/admin/sources" },
          { label: "MH 2025 Pipeline", value: "→", href: "/admin/maharashtra" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:shadow-md">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">Data Freshness</h2>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-50 text-emerald-800">{officialColleges} official colleges</Badge>
          <Badge className="bg-amber-50 text-amber-800">{pendingCutoffs} cutoffs pending verification</Badge>
          <Badge className="bg-slate-50">{imports} data imports</Badge>
        </div>
        <p className="text-sm text-slate-500">
          Import official MCC allotment PDFs and NMC seat matrices via the import pipeline (Phase 1.5).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/imports" className="card p-4 hover:shadow-md">
          <p className="font-medium">Data Import</p>
          <p className="text-sm text-slate-500">Upload CSV, Excel, or PDF for review</p>
        </Link>
        <Link href="/admin/audit" className="card p-4 hover:shadow-md">
          <p className="font-medium">Audit Log</p>
          <p className="text-sm text-slate-500">Track all admin modifications</p>
        </Link>
      </div>
    </div>
  );
}
