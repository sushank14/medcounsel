import { prisma } from "@medcounsel/database";
import Link from "next/link";
import { displayCollegeName } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 50;

export default async function CutoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; year?: string; counselling?: string; degree?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const where = {
    ...(params.category ? { category: params.category as never } : {}),
    ...(params.year ? { year: parseInt(params.year, 10) } : {}),
    ...(params.counselling ? { counselling: { code: params.counselling } } : {}),
    ...(params.degree ? { specialty: { degree: params.degree as never } } : {}),
  };

  const [aiqCount, mahCount, totalColleges, total, cutoffs] = await Promise.all([
    prisma.cutoff.count({ where: { counselling: { code: "AIQ" }, verificationStatus: "VERIFIED" } }),
    prisma.cutoff.count({ where: { counselling: { code: "MAHARASHTRA" }, verificationStatus: "VERIFIED" } }),
    prisma.college.count({ where: { dataStatus: "OFFICIAL" } }),
    prisma.cutoff.count({ where }),
    prisma.cutoff.findMany({
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      where,
      include: {
        college: true,
        specialty: true,
        counselling: true,
        round: true,
        source: true,
      },
      orderBy: [{ year: "desc" }, { closingRank: "asc" }],
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageUrl = (p: number) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.year) q.set("year", params.year);
    if (params.counselling) q.set("counselling", params.counselling);
    if (params.degree) q.set("degree", params.degree);
    q.set("page", String(p));
    return `/cutoffs?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cutoff Explorer</h1>
        <p className="text-slate-600">Browse historical closing ranks by category, quota, year, and round</p>
        <p className="mt-1 text-sm text-emerald-700">
          {aiqCount.toLocaleString()} AIQ (AIR) · {mahCount.toLocaleString()} Maharashtra (SML) ·{" "}
          {totalColleges.toLocaleString()} NEET-PG institutes
        </p>
      </div>

      <form method="GET" className="flex flex-wrap gap-2">
        <select name="category" defaultValue={params.category ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All categories</option>
          {["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="counselling" defaultValue={params.counselling ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All counselling</option>
          <option value="AIQ">AIQ (AIR ranks)</option>
          <option value="MAHARASHTRA">Maharashtra (SML ranks)</option>
        </select>
        <select name="degree" defaultValue={params.degree ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All courses</option>
          <option value="MD">MD</option>
          <option value="MS">MS</option>
          <option value="DNB">DNB</option>
        </select>
        <select name="year" defaultValue={params.year ?? ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">All years</option>
          {[2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Filter</button>
      </form>

      <p className="text-sm text-slate-500">
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} cutoffs
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="p-3">College</th>
              <th className="p-3">Specialty</th>
              <th className="p-3">Counselling</th>
              <th className="p-3">Category</th>
              <th className="p-3">Quota</th>
              <th className="p-3">Year/Round</th>
              <th className="p-3">Closing Rank</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {cutoffs.map((c) => (
              <tr key={c.id} className="border-b hover:bg-slate-50">
                <td className="p-3">
                  <Link href={`/colleges/${c.college.slug}`} className="text-brand-600 hover:underline">
                    {displayCollegeName(c.college.shortName || c.college.name)}
                  </Link>
                </td>
                <td className="p-3">{c.specialty.degree} {c.specialty.name}</td>
                <td className="p-3">{c.counselling.code}</td>
                <td className="p-3">{c.category}</td>
                <td className="p-3">{c.quota}</td>
                <td className="p-3">{c.year} {c.round?.round ?? ""}</td>
                <td className="p-3 font-medium">{formatRank(c.closingRank, c.rankType)}</td>
                <td className="p-3">
                  <Badge className={c.verificationStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                    {c.verificationStatus}
                  </Badge>
                  {c.source?.url && (
                    <a href={c.source.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs text-brand-600 hover:underline">
                      source
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
