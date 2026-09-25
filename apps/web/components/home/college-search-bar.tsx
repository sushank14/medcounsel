import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function CollegeSearchBar({ defaultQuery = "" }: { defaultQuery?: string }) {
  return (
    <form action="/colleges" method="GET" className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          placeholder="Search college name, city…"
          defaultValue={defaultQuery}
          className="pl-9"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Search
      </button>
    </form>
  );
}

export function HomeQuickLinks() {
  const links = [
    { href: "/my-chances", title: "My Chances", desc: "Colleges matching your rank" },
    { href: "/top-colleges", title: "Top Colleges", desc: "Branch-wise guides & Reddit-style picks" },
    { href: "/colleges", title: "All Colleges", desc: "Browse & filter 2,000+ institutes" },
    { href: "/cutoffs", title: "Cutoffs", desc: "Year-wise closing ranks" },
    { href: "/simulator", title: "What-If", desc: "Try different rank or category" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="card p-4 transition-shadow hover:shadow-md"
        >
          <p className="font-medium text-brand-700">{l.title}</p>
          <p className="text-sm text-slate-500">{l.desc}</p>
        </Link>
      ))}
    </div>
  );
}
