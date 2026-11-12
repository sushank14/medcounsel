import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AddPreferenceButton } from "@/components/mcc-finder/add-preference-button";
import { fieldInput, fieldSelect, sectionCard, sectionTitle } from "@/lib/form-field-classes";
import {
  SPECIALTY_FILTERS,
  compareColleges,
  filterRecords,
  groupLabel,
  parseFinderFilters,
  sortRecords,
  sourceLabel,
  sourceTotals,
  type FinderFilters,
  type FinderRecord,
  type FinderSource,
} from "@/lib/mcc-college-finder";
import { loadFinder } from "@/lib/mcc-college-finder-data";

const PAGE_SIZE = 40;

const GROUPS = [
  { id: "government", label: "Government medical colleges", note: "MD/MS rows are listed before other government courses." },
  { id: "dnb", label: "DNB institutes", note: "Government DNB and private DNB stay in this section, separate from MD/MS colleges." },
  { id: "private", label: "Private medical colleges", note: "Shown only when the official institute type is a private medical college." },
  { id: "deemed", label: "Deemed universities", note: "Official Deemed University rows." },
  { id: "other", label: "Other institutes", note: "Rows whose official type could not be classified." },
] as const;

function href(filters: FinderFilters, patch: Partial<FinderFilters> = {}): string {
  const next = { ...filters, ...patch };
  if (!("page" in patch)) next.page = 1;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.city) params.set("city", next.city);
  if (next.state) params.set("state", next.state);
  if (next.group) params.set("group", next.group);
  if (next.category !== "both") params.set("category", next.category);
  if (next.source) params.set("source", next.source);
  for (const spec of next.specs) params.append("spec", spec);
  if (next.sort && next.sort !== "priority") params.set("sort", next.sort);
  if (next.code) params.set("code", next.code);
  if (next.pick.length) params.set("pick", next.pick.join(","));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/mcc-college-finder?${query}` : "/mcc-college-finder";
}

function withPick(filters: FinderFilters, code: string): string {
  const pick = filters.pick.includes(code) ? filters.pick.filter((item) => item !== code) : [...filters.pick, code].slice(0, 8);
  return href(filters, { pick });
}

function seats(value: number | null): string {
  return typeof value === "number" ? value.toLocaleString("en-IN") : "—";
}

function CategoryBadge({ record }: { record: FinderRecord }) {
  const tone = record.seatCategory === "OBC" ? "bg-amber-50 text-amber-950" : record.seatCategory === "Open" ? "bg-sky-50 text-sky-950" : "bg-slate-100 text-slate-700";
  return (
    <Badge className={tone}>
      {record.seatCategory}
      {record.pwd ? " · PwD" : ""}
    </Badge>
  );
}

function SourceBadge({ source }: { source: FinderSource }) {
  const tone = source === "clear" ? "bg-emerald-50 text-emerald-900" : source === "virtual" ? "bg-orange-50 text-orange-950" : "bg-violet-50 text-violet-950";
  return <Badge className={tone}>{sourceLabel(source)}</Badge>;
}

export default async function MccCollegeFinderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFinderFilters(await searchParams);
  const { records, states } = loadFinder();
  const scoped = filterRecords(records, { ...filters, group: "", code: "" });
  const sectionRecords = {
    government: scoped.filter((record) => record.group === "government_mdms" || record.group === "government_other"),
    dnb: scoped.filter((record) => record.group === "dnb"),
    private: scoped.filter((record) => record.group === "private"),
    deemed: scoped.filter((record) => record.group === "deemed"),
    other: scoped.filter((record) => record.group === "other"),
  };
  const filtered = sortRecords(filterRecords(records, { ...filters, code: "" }), filters.sort);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totals = sourceTotals(filtered);
  const collegeRows = filters.code ? records.filter((record) => record.code === filters.code) : [];
  const college = collegeRows[0];
  const collegeTotals = sourceTotals(collegeRows);
  const comparison = filters.pick.length
    ? compareColleges(
        filterRecords(records, { ...filters, group: "", source: "", state: "", city: "", q: "", code: "", page: 1 }),
        filters.pick,
      )
    : [];
  const stateCounts = new Map<string, Set<string>>();
  for (const record of sectionRecords.government) {
    if (!record.code) continue;
    const set = stateCounts.get(record.state) ?? new Set<string>();
    set.add(record.code);
    stateCounts.set(record.state, set);
  }
  const stateLeaders = [...stateCounts.entries()]
    .map(([state, codes]) => ({ state, colleges: codes.size }))
    .sort((a, b) => b.colleges - a.colleges || a.state.localeCompare(b.state))
    .slice(0, 8);

  return (
    <div className="page">
      <PageHeader
        kicker="MCC All India Quota · NEET PG 2026 · OBC and Open"
        title="MCC College Finder"
        description="Government MD/MS colleges come first, then other government courses, then DNB institutes. OBC and Open seats stay labelled separately. An OBC candidate can also look at Open seats. Virtual vacancies are not confirmed seats."
        actions={
          <Link href="/mcc-college-finder/list" className="text-sm font-medium text-brand-700 hover:underline">
            My preference list
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GROUPS.map((group) => {
          const rows = sectionRecords[group.id];
          const counts = sourceTotals(rows);
          const active = filters.group === group.id;
          return (
            <Link key={group.id} href={href(filters, { group: active ? "" : group.id })} className={`${sectionCard} block ${group.id === "government" || group.id === "dnb" ? "border-brand-200 bg-brand-50/40" : ""} ${active ? "ring-2 ring-brand-500" : ""}`}>
              <h2 className="text-sm font-semibold text-slate-900">{group.label}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{group.note}</p>
              <p className="mt-2 text-xs text-slate-700">
                Clear {counts.clear.seats.toLocaleString("en-IN")} · Virtual {counts.virtual.seats.toLocaleString("en-IN")} · New {counts.new.seats.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-slate-500">{rows.length.toLocaleString("en-IN")} printed rows in this view</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {(["clear", "virtual", "new"] as const).map((source) => (
          <Link key={source} href={href(filters, { source: filters.source === source ? "" : source })} className={`${sectionCard} ${filters.source === source ? "ring-2 ring-brand-500" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{sourceLabel(source)}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totals[source].seats.toLocaleString("en-IN")}</p>
            <p className="text-xs text-slate-500">{totals[source].rows.toLocaleString("en-IN")} rows · not added to the other totals</p>
          </Link>
        ))}
      </section>
      {filters.source === "virtual" || totals.virtual.rows > 0 ? (
        <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950">
          Virtual vacancies are indicative seats from the virtual vacancy PDF. They are not guaranteed clear vacancies.
        </p>
      ) : null}

      <form method="get" className={sectionCard}>
        <h2 className={sectionTitle}>Search and filters</h2>
        <p className="mt-1 text-sm text-slate-500">MCC does not publish a separate city column. City search looks through the printed institute address. Default seat categories are OBC and Open together.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input name="q" defaultValue={filters.q} placeholder="College, code, or speciality" className={fieldInput} aria-label="College, code, or speciality" />
          <input name="city" defaultValue={filters.city} placeholder="City or address text" className={fieldInput} aria-label="City or address text" />
          <select name="state" defaultValue={filters.state} className={fieldSelect} aria-label="State">
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <select name="group" defaultValue={filters.group} className={fieldSelect} aria-label="Institute section">
            <option value="">All institute sections</option>
            {GROUPS.map((group) => (
              <option key={group.id} value={group.id}>{group.label}</option>
            ))}
            <option value="government_mdms">Government MD/MS only</option>
            <option value="government_other">Other government courses</option>
          </select>
          <select name="source" defaultValue={filters.source} className={fieldSelect} aria-label="Availability">
            <option value="">Clear, virtual, and newly added</option>
            <option value="clear">Clear vacancy only</option>
            <option value="virtual">Virtual vacancy only</option>
            <option value="new">Newly added only</option>
          </select>
          <select name="sort" defaultValue={filters.sort} className={fieldSelect} aria-label="Sort">
            <option value="priority">Government, then DNB</option>
            <option value="type">Institute type</option>
            <option value="state">State</option>
            <option value="city">Institute address</option>
            <option value="specialty">Speciality</option>
            <option value="name">College name</option>
            <option value="obc">OBC seats first</option>
            <option value="open">Open seats first</option>
            <option value="clear">Clear vacancy first</option>
            <option value="virtual">Virtual vacancy first</option>
            <option value="new">Newly added first</option>
          </select>
          {filters.pick.length > 0 ? <input type="hidden" name="pick" value={filters.pick.join(",")} /> : null}
        </div>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-slate-800">Seat category</legend>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {[
              ["both", "OBC + Open"],
              ["obc", "OBC only"],
              ["open", "Open / General only"],
            ].map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input type="radio" name="category" value={value} defaultChecked={filters.category === value} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-slate-800">Specialities</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SPECIALTY_FILTERS.map((spec) => (
              <label key={spec.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="spec" value={spec.id} defaultChecked={filters.specs.includes(spec.id)} className="mt-1" />
                <span>
                  {spec.label}
                  {spec.hint ? <span className="block text-xs text-slate-500">{spec.hint}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Apply</button>
          <Link href="/mcc-college-finder" className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Reset</Link>
        </div>
      </form>

      {stateLeaders.length > 0 ? (
        <section className={sectionCard}>
          <h2 className={sectionTitle}>States with the most government colleges in this view</h2>
          <p className="mt-1 text-sm text-slate-500">Counts are unique institute codes, not seat rows. Open the state to see its colleges.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stateLeaders.map((item) => (
              <Link key={item.state} href={href(filters, { state: item.state, group: filters.group || "government" })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-300">
                {item.state} · {item.colleges.toLocaleString("en-IN")}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {college ? (
        <section className={sectionCard}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className={sectionTitle}>{college.institute}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Code {college.code} · {college.state} · {college.officialType} · {groupLabel(college.group)}
                {college.dnbKind ? ` · ${college.dnbKind} DNB` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">City is not a separate MCC column. The institute cell above is the printed name and address.</p>
            </div>
            <Link href={href(filters, { code: "" })} className="text-sm text-brand-700 hover:underline">Close college</Link>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            All printed categories for this code: clear {collegeTotals.clear.seats.toLocaleString("en-IN")} seats ({collegeTotals.clear.rows.toLocaleString("en-IN")} rows), virtual {collegeTotals.virtual.seats.toLocaleString("en-IN")} ({collegeTotals.virtual.rows.toLocaleString("en-IN")} rows), newly added {collegeTotals.new.seats.toLocaleString("en-IN")} ({collegeTotals.new.rows.toLocaleString("en-IN")} rows).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[880px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Speciality</th>
                  <th className="px-2 py-2">Quota</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Seats</th>
                  <th className="px-2 py-2">Availability</th>
                  <th className="px-2 py-2">Page</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {collegeRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-2">{row.branch}<span className="block text-xs text-slate-500">{row.degree || "Degree not printed"}</span></td>
                    <td className="px-2 py-2">{row.quota}</td>
                    <td className="px-2 py-2">{row.category} · {row.seatCategory}{row.pwd ? " · PwD" : ""}</td>
                    <td className="px-2 py-2">{seats(row.seats)}</td>
                    <td className="px-2 py-2"><SourceBadge source={row.source} /></td>
                    <td className="px-2 py-2">{row.page}</td>
                    <td className="px-2 py-2"><AddPreferenceButton id={row.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {comparison.length > 0 ? (
        <section className={sectionCard}>
          <h2 className={sectionTitle}>Compare selected colleges</h2>
          <p className="mt-1 text-sm text-slate-500">Each line is one printed branch, quota, and category. Clear, virtual, and newly added seats are not combined. {filters.pick.length} {filters.pick.length === 1 ? "college" : "colleges"} selected.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">College</th>
                  <th className="px-2 py-2">State</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Speciality</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Clear</th>
                  <th className="px-2 py-2">Virtual</th>
                  <th className="px-2 py-2">New</th>
                  <th className="px-2 py-2">Source pages</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((line) => (
                  <tr key={`${line.code}-${line.branch}-${line.quota}-${line.category}`} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2">{line.institute}<span className="block text-xs text-slate-500">{line.code}</span></td>
                    <td className="px-2 py-2">{line.state}</td>
                    <td className="px-2 py-2">{groupLabel(line.group)}<span className="block text-xs text-slate-500">{line.officialType}</span></td>
                    <td className="px-2 py-2">{line.branch}<span className="block text-xs text-slate-500">{line.degree} · {line.quota}</span></td>
                    <td className="px-2 py-2">{line.seatCategory}{line.pwd ? " · PwD" : ""}<span className="block text-xs text-slate-500">{line.category}</span></td>
                    <td className="px-2 py-2">{line.clearSeats} <span className="text-xs text-slate-500">({line.clearRows} rows)</span></td>
                    <td className="px-2 py-2">{line.virtualSeats} <span className="text-xs text-slate-500">({line.virtualRows} rows)</span></td>
                    <td className="px-2 py-2">{line.newSeats} <span className="text-xs text-slate-500">({line.newRows} rows)</span></td>
                    <td className="px-2 py-2 text-xs text-slate-500">{line.pages.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className={sectionCard}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>{filtered.length.toLocaleString("en-IN")} rows in this view</h2>
          <p className="text-xs text-slate-500">Page {page} of {pageCount}</p>
        </div>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">College</th>
                <th className="px-2 py-2">Branch</th>
                <th className="px-2 py-2">Seat category</th>
                <th className="px-2 py-2">Seat type</th>
                <th className="px-2 py-2">Seats</th>
                <th className="px-2 py-2">Availability</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <Link href={href(filters, { code: row.code })} className="font-medium text-brand-700 hover:underline">{row.institute}</Link>
                    <span className="block text-xs text-slate-500">{row.state} · {row.code} · {row.officialType}</span>
                  </td>
                  <td className="px-2 py-2">{row.branch}<span className="block text-xs text-slate-500">{row.degree || "Degree not printed"} · {row.quota}</span></td>
                  <td className="px-2 py-2"><CategoryBadge record={row} /><span className="mt-1 block text-xs text-slate-500">{row.category}</span></td>
                  <td className="px-2 py-2">{groupLabel(row.group)}{row.dnbKind ? ` · ${row.dnbKind}` : ""}</td>
                  <td className="px-2 py-2">{seats(row.seats)}</td>
                  <td className="px-2 py-2"><SourceBadge source={row.source} /><span className="mt-1 block text-xs text-slate-500">p.{row.page}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <AddPreferenceButton id={row.id} />
                      <Link href={withPick(filters, row.code)} className="text-xs text-slate-600 hover:underline">{filters.pick.includes(row.code) ? "Remove compare" : "Compare"}</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-3 md:hidden">
          {slice.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <Link href={href(filters, { code: row.code })} className="font-medium text-brand-700">{row.institute}</Link>
              <p className="text-xs text-slate-500">{row.state} · {row.code} · {groupLabel(row.group)}</p>
              <p className="mt-1">{row.branch}</p>
              <p className="text-xs text-slate-600">{row.quota} · {row.seatCategory}{row.pwd ? " · PwD" : ""} · {seats(row.seats)} seats · {sourceLabel(row.source)} p.{row.page}</p>
              <div className="mt-2 flex gap-2">
                <AddPreferenceButton id={row.id} />
                <Link href={withPick(filters, row.code)} className="text-xs text-slate-600">{filters.pick.includes(row.code) ? "Remove compare" : "Compare"}</Link>
              </div>
            </li>
          ))}
        </ul>
        {slice.length === 0 ? <p className="mt-3 text-sm text-slate-500">No rows match these filters.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {page > 1 ? <Link href={href(filters, { page: page - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Previous</Link> : null}
          {page < pageCount ? <Link href={href(filters, { page: page + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Next</Link> : null}
        </div>
      </section>
    </div>
  );
}
