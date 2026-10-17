import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function AdminStipendsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const stipends = await prisma.stipend.findMany({
    take: 50,
    include: { college: true },
    orderBy: { totalMonthly: "desc" },
  });

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stipends</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="p-3">College</th>
              <th className="p-3">Year</th>
              <th className="p-3">Monthly</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {stipends.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="p-3">{s.college.shortName}</td>
                <td className="p-3">{s.yearOfTraining}</td>
                <td className="p-3 font-medium">{formatCurrency(s.totalMonthly)}</td>
                <td className="p-3">
                  <Badge className={s.verificationStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                    {s.verificationStatus}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
