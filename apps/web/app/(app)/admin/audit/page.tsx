import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      {logs.length === 0 ? (
        <p className="text-slate-500">No audit entries yet. Admin actions will be logged here.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-slate-500">
                <th className="p-3">Action</th>
                <th className="p-3">User</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-3">{l.action}</td>
                  <td className="p-3">{l.user.email}</td>
                  <td className="p-3">{l.entity} {l.entityId?.slice(0, 8)}</td>
                  <td className="p-3">{l.timestamp.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
