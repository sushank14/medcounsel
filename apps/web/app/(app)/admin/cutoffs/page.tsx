import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";

export default async function AdminCutoffsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.cutoff.findMany({
    where: { verificationStatus: "PENDING" },
    take: 50,
    include: { college: true, specialty: true, counselling: true },
    orderBy: { year: "desc" },
  });

  const [verified, pendingCount, total] = await Promise.all([
    prisma.cutoff.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.cutoff.count({ where: { verificationStatus: "PENDING" } }),
    prisma.cutoff.count(),
  ]);

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cutoff Verification</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{total.toLocaleString()}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Verified</p><p className="text-2xl font-bold text-emerald-700">{verified.toLocaleString()}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-2xl font-bold text-amber-700">{pendingCount.toLocaleString()}</p></div>
      </div>

      {pending.length === 0 ? (
        <p className="text-slate-500">All cutoffs verified. Run MCC import to refresh data.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-slate-500">
                <th className="p-3">College</th>
                <th className="p-3">Specialty</th>
                <th className="p-3">Year</th>
                <th className="p-3">Closing</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="p-3">{c.college.shortName}</td>
                  <td className="p-3">{c.specialty.name}</td>
                  <td className="p-3">{c.year}</td>
                  <td className="p-3">{c.closingRank}</td>
                  <td className="p-3"><Badge className="bg-amber-50 text-amber-800">PENDING</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
