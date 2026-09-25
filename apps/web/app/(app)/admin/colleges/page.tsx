import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@medcounsel/database";
import { Badge } from "@/components/ui/badge";

export default async function AdminCollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const PAGE_SIZE = 40;

  const where = params.q
    ? { name: { contains: params.q } }
    : {};

  const [total, colleges] = await Promise.all([
    prisma.college.count({ where }),
    prisma.college.findMany({
      where,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      orderBy: { name: "asc" },
      include: { _count: { select: { cutoffs: true, specialties: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Colleges ({total.toLocaleString()})</h1>
        <BackLink fallbackHref="/admin" />
      </div>

      <form method="GET" className="flex gap-2">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search colleges..." className="rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Search</button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="p-3">Name</th>
              <th className="p-3">State</th>
              <th className="p-3">Type</th>
              <th className="p-3">MCC Code</th>
              <th className="p-3">Programs</th>
              <th className="p-3">Cutoffs</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-3">
                  <Link href={`/colleges/${c.slug}`} className="text-brand-600 hover:underline">{c.shortName}</Link>
                </td>
                <td className="p-3">{c.state}</td>
                <td className="p-3">{c.collegeType}</td>
                <td className="p-3 font-mono text-xs">{c.nmcId ?? "—"}</td>
                <td className="p-3">{c._count.specialties}</td>
                <td className="p-3">{c._count.cutoffs}</td>
                <td className="p-3">
                  <Badge className={c.dataStatus === "OFFICIAL" ? "bg-emerald-50 text-emerald-800" : "bg-purple-50 text-purple-800"}>
                    {c.dataStatus}
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
