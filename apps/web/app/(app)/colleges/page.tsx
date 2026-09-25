import Link from "next/link";
import { prisma } from "@medcounsel/database";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  displayCollegeName,
  excludeDemoCollegesWhere,
  formatCollegeLocation,
  INDIAN_STATES,
  isGarbageCollegeName,
} from "@medcounsel/types";
import { collegesSearchHref } from "@/lib/colleges-nav";

const PAGE_SIZE = 24;

function CollegePagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="sticky bottom-[4.5rem] z-10 -mx-4 border-t bg-white/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:static sm:mx-0 sm:rounded-lg sm:border sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex flex-wrap gap-2">
          {page > 1 && (
            <Link
              href={collegesSearchHref(params, page - 1)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              ← Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={collegesSearchHref(params, page + 1)}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const where = {
    ...(params.q ? { name: { contains: params.q } } : {}),
    ...(params.state ? { state: params.state } : {}),
    ...(params.type ? { collegeType: params.type as never } : {}),
    AND: [
      excludeDemoCollegesWhere,
      {
        NOT: [
          { name: { startsWith: "&" } },
          { name: { contains: "Not Reported" } },
          { name: { contains: "Not Allotted" } },
        ],
      },
    ],
  };

  const [total, colleges] = await Promise.all([
    prisma.college.count({ where }),
    prisma.college.findMany({
      where,
      include: {
        specialties: { include: { specialty: true }, take: 5 },
        fees: { take: 1 },
        stipends: { where: { yearOfTraining: "Y1" }, take: 1 },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">College Search</h1>
        <p className="text-slate-600">{total.toLocaleString("en-IN")} colleges · page {page} of {totalPages || 1}</p>
      </div>

      <form method="GET" className="card grid gap-3 p-4 sm:grid-cols-4">
        <Input name="q" placeholder="Search colleges..." defaultValue={params.q} />
        <Select name="state" defaultValue={params.state ?? ""}>
          <option value="">All states</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select name="type" defaultValue={params.type ?? ""}>
          <option value="">All types</option>
          <option value="GOVT">Government</option>
          <option value="PRIVATE">Private</option>
          <option value="DEEMED">Deemed</option>
          <option value="CENTRAL">Central</option>
        </Select>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Search
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {colleges.filter((c) => !isGarbageCollegeName(c.name)).map((c) => (
          <Link key={c.id} href={`/colleges/${c.slug}`} className="card p-4 hover:shadow-md">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{displayCollegeName(c.name)}</h3>
            </div>
            <p className="text-sm text-slate-600">{formatCollegeLocation(c.city, c.state, c.name, c.slug)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{c.collegeType}</Badge>
              <Badge className="bg-slate-50">{c.specialties.length} specialties</Badge>
              {c.fees[0] && <Badge className="bg-slate-50">₹{(c.fees[0].totalAnnual / 100000).toFixed(1)}L/yr</Badge>}
              {c.stipends[0] && <Badge className="bg-emerald-50 text-emerald-800">₹{c.stipends[0].totalMonthly.toLocaleString("en-IN")}/mo stipend</Badge>}
            </div>
          </Link>
        ))}
      </div>

      <CollegePagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}
