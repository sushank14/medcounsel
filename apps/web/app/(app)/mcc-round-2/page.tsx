import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { fieldInput, fieldSelect, sectionCard, sectionTitle } from "@/lib/form-field-classes";
import {
  VACANCY_LABEL,
  collegeSummary,
  filterRecords,
  loadRound2,
  parseRound2Filters,
  round2DatasetAvailable,
  type Round2Filters,
  type Round2Record,
  type VacancyType,
} from "@/lib/mcc-round2";

const PAGE_SIZE = 40;

const TABS: { id: Round2Filters["tab"]; label: string }[] = [
  { id: "clear", label: "Clear vacancies" },
  { id: "virtual", label: "Virtual vacancies" },
  { id: "new", label: "New seats" },
  { id: "new-colleges", label: "Newly added colleges" },
  { id: "all", label: "Complete database" },
];

function href(filters: Round2Filters, patch: Partial<Round2Filters> = {}): string {
  const next = { ...filters, ...patch };
  if (!("page" in patch)) next.page = 1;
  const params = new URLSearchParams();
  params.set("tab", next.tab);
  if (next.q) params.set("q", next.q);
  if (next.state) params.set("state", next.state);
  if (next.type) params.set("type", next.type);
  if (next.degree) params.set("degree", next.degree);
  if (next.specialty) params.set("specialty", next.specialty);
  if (next.quota) params.set("quota", next.quota);
  if (next.category) params.set("category", next.category);
  if (next.vacancy && next.tab === "all") params.set("vacancy", next.vacancy);
  if (next.code) params.set("code", next.code);
  if (next.page > 1) params.set("page", String(next.page));
  return `/mcc-round-2?${params.toString()}`;
}

function seats(row: Round2Record): string {
  return typeof row.seats === "number" ? row.seats.toLocaleString("en-IN") : "—";
}

function categoryText(row: Round2Record): string {
  const pwd = row.pwd ? " · PwD" : "";
  return `${row.category_label || row.category_raw}${pwd}`;
}

export default async function MccRound2Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!round2DatasetAvailable()) {
    return (
      <div className="page">
        <PageHeader
          kicker="MCC NEET PG 2026"
          title="Round 2 updates"
          description="The 10 November extract has been removed. The corrected 11 November Excel files are saved for review and are not published on this page yet."
        />
      </div>
    );
  }

  const filters = parseRound2Filters(await searchParams);
  const { records, validation, comparison, options } = loadRound2();
  const filtered = filterRecords(records, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const seatTotal = filtered.reduce((sum, row) => sum + (typeof row.seats === "number" ? row.seats : 0), 0);
  const college = filters.code ? collegeSummary(records, filters.code) : null;
  const query = filters.q.toLowerCase();
  const newColleges = comparison.new_colleges.filter((collegeRow) => {
    if (!query) return true;
    return `${collegeRow.institute_name} ${collegeRow.institute_code} ${collegeRow.state}`.toLowerCase().includes(query);
  });
  const newSpecialties = comparison.new_specialties.filter((row) => {
    if (!query) return true;
    return `${row.institute_name} ${row.specialty} ${row.branch} ${row.institute_code}`.toLowerCase().includes(query);
  });

  return (
    <div className="page">
      <PageHeader
        kicker="MCC NEET PG 2026"
        title="Round 2 updates"
        description="Clear vacancies, virtual vacancies, and newly added seats from the three official MCC PDFs. Virtual vacancies are listed separately and are not confirmed clear seats."
        actions={
          <a
            href="https://mcc.nic.in/document-category/current-events/"
            className="text-sm font-medium text-brand-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            MCC current events
          </a>
        }
      />

      {!validation.dataset_complete && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">This dataset is not marked complete.</p>
          <p className="mt-1">
            The official virtual vacancy PDF is published at exactly 1,048,576 bytes and has no catalog or end-of-file
            marker. Every complete page inside that file was extracted. Pages after that cut are missing, so virtual
            totals are partial. Clear vacancy and newly added seats were read from their full PDFs.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clear vacancy seats" value={validation.seat_totals.clear_vacancy_seats} hint="Matches the printed PDF total" />
        <Stat label="Virtual vacancy seats" value={validation.seat_totals.virtual_vacancy_seats} hint="Only the pages present in the truncated PDF" />
        <Stat label="Newly added seats" value={validation.seat_totals.newly_added_seats} hint="Matches the printed PDF total" />
        <Stat label="Colleges in Round 2 files" value={validation.unique_colleges_in_round2} hint={`${validation.new_college_count} not in Round 1`} />
      </div>

      <section className={sectionCard}>
        <h2 className={sectionTitle}>Reconciliation</h2>
        <p className="mt-1 text-sm text-slate-600">
          Counts are from the extraction run at {validation.extracted_at}. A row is verified only when the college
          code, course, category, and seat count were printed on that row. Clear vacancy and new seats match the
          totals printed on the last page of each PDF. Virtual errors are the pages missing from the truncated
          official file, plus rows whose institute code was clipped and not printed.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Source PDF</th>
                <th className="px-2 py-2">Total pages</th>
                <th className="px-2 py-2">Extracted records</th>
                <th className="px-2 py-2">Verified records</th>
                <th className="px-2 py-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {validation.reconciliation.map((row) => (
                <tr key={row.source_pdf} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium">{row.source_pdf}</td>
                  <td className="px-2 py-2">{row.total_pages.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2">{row.extracted_records.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2">{row.verified_records.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2">{row.errors.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={href(filters, { tab: tab.id, page: 1 })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              filters.tab === tab.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {filters.tab === "virtual" && (
        <div className="card border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
          Virtual vacancies are indicative seats MCC may allot if a joined Round 1 candidate resigns or upgrades.
          They are not confirmed clear vacancies. Do not add them to the clear-vacancy total.
        </div>
      )}

      <section className={sectionCard}>
        <h2 className={sectionTitle}>Round 1 comparison</h2>
        {comparison.round1_available ? (
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p>
              Compared with the Round 1 AIQ sheet, DNB sheet, deemed PDF, and central PDF already in MedCounsel
              ({comparison.round1_college_codes.toLocaleString("en-IN")} institute codes). A college is new only when
              its code is absent from all of those. A new course at an existing college is not treated as a new college.
            </p>
            <p>
              <strong>{comparison.new_college_count.toLocaleString("en-IN")}</strong> newly identified colleges.{" "}
              <strong>{comparison.new_specialty_count.toLocaleString("en-IN")}</strong> newly identified specialties at
              colleges that already existed. Newly added seats on an existing course, quota, and category:{" "}
              <strong>{comparison.seat_increase_on_existing_keys_seats.toLocaleString("en-IN")}</strong>. Newly added
              seats on a course or category that was not in Round 1:{" "}
              <strong>{comparison.seat_addition_on_new_keys_seats.toLocaleString("en-IN")}</strong>.
            </p>
            <p>
              <strong>{comparison.colleges_with_no_round2_rows_count.toLocaleString("en-IN")}</strong> Round 1 colleges
              do not appear in any Round 2 document.
            </p>
            <p>{comparison.seat_decrease_note}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Round 1 comparison is unavailable. The Round 1 matrix files were not found.</p>
        )}
      </section>

      {filters.tab === "new-colleges" && (
        <section className={sectionCard}>
          <h2 className={sectionTitle}>Newly added colleges ({newColleges.length.toLocaleString("en-IN")})</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {newColleges.slice(0, 80).map((collegeRow) => (
              <li key={collegeRow.institute_code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={href(filters, { tab: "all", code: collegeRow.institute_code, page: 1 })} className="font-medium text-brand-700 hover:underline">
                    {collegeRow.institute_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {collegeRow.state} · {collegeRow.institute_type} · code {collegeRow.institute_code}
                  </p>
                </div>
                <p className="text-xs text-slate-600">
                  Clear {collegeRow.clear_seats} · Virtual {collegeRow.virtual_seats} · New {collegeRow.new_seats}
                </p>
              </li>
            ))}
          </ul>
          {newColleges.length > 80 && (
            <p className="mt-2 text-xs text-slate-500">Showing 80 of {newColleges.length}. Search by college name to narrow the list.</p>
          )}
        </section>
      )}

      {filters.tab === "new" && (
        <section className={sectionCard}>
          <h2 className={sectionTitle}>Newly identified specialties ({newSpecialties.length.toLocaleString("en-IN")})</h2>
          <p className="mt-1 text-sm text-slate-600">
            Specialties in the newly added seats PDF that this college did not have in the Round 1 matrix. Existing
            colleges are not marked as new colleges.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {newSpecialties.slice((page - 1) * 20, page * 20).map((row) => (
              <li key={`${row.institute_code}-${row.branch}-${row.quota}`} className="py-2 text-sm">
                <Link href={href(filters, { tab: "all", code: row.institute_code })} className="font-medium text-brand-700 hover:underline">
                  {row.institute_name}
                </Link>
                <span className="text-slate-600"> · {row.branch}</span>
                <span className="block text-xs text-slate-500">
                  {row.state} · {row.quota} · code {row.institute_code} · page {row.page}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form method="get" className={sectionCard}>
        <p className={sectionTitle}>Search and filters</p>
        <input type="hidden" name="tab" value={filters.tab} />
        {filters.code && <input type="hidden" name="code" value={filters.code} />}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input name="q" defaultValue={filters.q} placeholder="College, code, or specialty" className={fieldInput} />
          <Select name="state" label="All states" value={filters.state} options={options.states} />
          <Select name="type" label="All college types" value={filters.type} options={options.types} />
          <Select name="degree" label="All degrees" value={filters.degree} options={options.degrees} />
          <Select name="specialty" label="All specialties" value={filters.specialty} options={options.specialties} />
          <Select name="quota" label="All quotas" value={filters.quota} options={options.quotas} />
          <Select name="category" label="All categories" value={filters.category} options={options.categories} />
          {filters.tab === "all" && (
            <select name="vacancy" defaultValue={filters.vacancy} className={fieldSelect}>
              <option value="">All vacancy types</option>
              <option value="clear">Clear</option>
              <option value="virtual">Virtual</option>
              <option value="new">Newly added</option>
            </select>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
          <Link href={href({ ...filters, q: "", state: "", type: "", degree: "", specialty: "", quota: "", category: "", vacancy: "", code: "", page: 1 }, { page: 1 })} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
            Reset
          </Link>
        </div>
      </form>

      {college && (
        <section className={sectionCard}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className={sectionTitle}>{college.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Code {college.code} · {college.state} · {college.type}
              </p>
              <p className="mt-1 text-xs text-slate-500">{college.address}</p>
              <p className="mt-1 text-xs text-slate-500">MCC does not publish a separate city column. The institute cell is shown in full.</p>
            </div>
            <Link href={href(filters, { code: "", page: 1 })} className="text-sm text-brand-700 hover:underline">
              Clear college
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Clear {college.clear.toLocaleString("en-IN")} · Virtual {college.virtual.toLocaleString("en-IN")} · Newly added{" "}
            {college.added.toLocaleString("en-IN")}. Totals are sums of category rows. Specialties are not merged.
          </p>
          <div className="mt-3 space-y-3">
            {college.courses.map((course) => (
              <div key={`${course.branch}-${course.quota}`} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium">{course.branch}</p>
                <p className="text-xs text-slate-500">
                  {course.degree || "Degree not printed"} · {course.quota}
                </p>
                <p className="mt-1 text-slate-700">
                  Clear {course.clear} · Virtual {course.virtual} · New {course.added}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {course.categories.map((item, index) => (
                    <li key={`${item.vacancy}-${item.category}-${item.page}-${index}`}>
                      {VACANCY_LABEL[item.vacancy]} · {item.category} · {item.seats} seat{item.seats === 1 ? "" : "s"} · {item.source} p.{item.page}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={sectionCard}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>
            {filtered.length.toLocaleString("en-IN")} rows · {seatTotal.toLocaleString("en-IN")} seats in this view
          </h2>
          <p className="text-xs text-slate-500">
            Page {page} of {pageCount}
          </p>
        </div>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="min-w-[960px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">College</th>
                <th className="px-2 py-2">Course</th>
                <th className="px-2 py-2">Quota</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Seats</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <Link href={href(filters, { code: row.institute_code, page: 1 })} className="font-medium text-brand-700 hover:underline">
                      {row.institute_name || "Name not printed"}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {row.state} · {row.institute_type} · {row.institute_code || "code not printed"}
                    </span>
                    {row.institute_code_source === "unique_name_match" && (
                      <Badge className="mt-1 bg-amber-50 text-amber-900">Code matched, not printed on this row</Badge>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {row.branch || "—"}
                    <span className="block text-xs text-slate-500">{row.degree || "Degree not printed"}</span>
                  </td>
                  <td className="px-2 py-2">{row.quota || "—"}</td>
                  <td className="px-2 py-2">{categoryText(row)}</td>
                  <td className="px-2 py-2">{seats(row)}</td>
                  <td className="px-2 py-2">{VACANCY_LABEL[row.vacancy_type as VacancyType]}</td>
                  <td className="px-2 py-2 text-xs">
                    <a href={row.source_url} className="text-brand-700 hover:underline" target="_blank" rel="noreferrer">
                      {row.source_label}
                    </a>
                    <span className="block text-slate-500">p. {row.page}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-3 md:hidden">
          {slice.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <Link href={href(filters, { code: row.institute_code, page: 1 })} className="font-medium text-brand-700">
                {row.institute_name || "Name not printed"}
              </Link>
              <p className="text-xs text-slate-500">
                {row.state} · {row.institute_code || "code not printed"}
              </p>
              <p className="mt-1">{row.branch}</p>
              <p className="text-xs text-slate-600">
                {row.quota} · {categoryText(row)} · {seats(row)} {row.seats === 1 ? "seat" : "seats"}
              </p>
              <p className="text-xs text-slate-500">
                {VACANCY_LABEL[row.vacancy_type as VacancyType]} · {row.source_label} p.{row.page}
              </p>
            </li>
          ))}
        </ul>
        {slice.length === 0 && <p className="mt-3 text-sm text-slate-500">No rows match these filters.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {page > 1 && (
            <Link href={href(filters, { page: page - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              Previous
            </Link>
          )}
          {page < pageCount && (
            <Link href={href(filters, { page: page + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              Next
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card card-tile">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString("en-IN")}</p>
      <p className="text-sm text-slate-600">{hint}</p>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <select name={name} defaultValue={value} className={fieldSelect}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
