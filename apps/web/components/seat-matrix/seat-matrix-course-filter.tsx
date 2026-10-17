"use client";

import { useEffect, useMemo, useState } from "react";
import { fieldInput } from "@/lib/form-field-classes";

export interface CourseOption {
  slug: string;
  label: string;
}

export function SeatMatrixCourseFilter({
  options,
  selected,
}: {
  options: CourseOption[];
  selected: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => selected.length > 0);
  const [checked, setChecked] = useState(() => new Set(selected));

  useEffect(() => {
    setChecked(new Set(selected));
    if (selected.length > 0) setOpen(true);
  }, [selected]);

  const optionsBySlug = useMemo(() => new Map(options.map((o) => [o.slug, o])), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const filteredSlugs = useMemo(() => new Set(filtered.map((o) => o.slug)), [filtered]);

  /** Checked branches not visible in the current search — must stay in the form on Apply. */
  const selectedOffScreen = useMemo(
    () =>
      Array.from(checked)
        .filter((slug) => !filteredSlugs.has(slug))
        .map((slug) => optionsBySlug.get(slug) ?? { slug, label: slug }),
    [checked, filteredSlugs, optionsBySlug]
  );

  const toggle = (slug: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  };

  return (
    <>
      {/* Outside <details> so Apply always submits every selected branch (even when panel is closed). */}
      {Array.from(checked).map((slug) => (
        <input key={`course-hidden-${slug}`} type="hidden" name="course" value={slug} readOnly />
      ))}

      <details
        className="w-full min-w-[240px] flex-[1_1_280px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none px-1 py-1.5 text-sm font-medium text-slate-800">
          {checked.size > 0
            ? `${checked.size} course${checked.size === 1 ? "" : "s"} selected`
            : "Courses (optional)"}
        </summary>
        <div
          className="mt-3 space-y-3 border-t border-slate-100 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branch name…"
            className={`${fieldInput} w-full`}
            aria-label="Search courses"
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Select one or more branches. Leave all unchecked to include every course. Search only narrows the
            list — other selections stay active when you apply filters.
          </p>
          {selectedOffScreen.length > 0 && (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2">
              <p className="text-xs font-medium text-brand-900">
                {selectedOffScreen.length} selected branch{selectedOffScreen.length === 1 ? "" : "es"} hidden by
                search (still included):
              </p>
              <ul className="space-y-1">
                {selectedOffScreen.slice(0, 12).map((o) => (
                  <li key={o.slug}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-sm hover:bg-brand-50/80">
                      <input
                        type="checkbox"
                        checked={checked.has(o.slug)}
                        onChange={(e) => toggle(o.slug, e.target.checked)}
                        className="mt-0.5 shrink-0"
                        aria-label={o.label}
                      />
                      <span className="leading-snug text-slate-800">{o.label}</span>
                    </label>
                  </li>
                ))}
                {selectedOffScreen.length > 12 && (
                  <li className="text-xs text-brand-800">…and {selectedOffScreen.length - 12} more</li>
                )}
              </ul>
            </div>
          )}
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No courses match this search.</p>
            ) : (
              filtered.map((o) => {
                if (selectedOffScreen.some((x) => x.slug === o.slug)) return null;
                return (
                  <label
                    key={o.slug}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(o.slug)}
                      onChange={(e) => toggle(o.slug, e.target.checked)}
                      className="mt-1 shrink-0"
                      aria-label={o.label}
                    />
                    <span className="leading-snug text-slate-700">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>
          {query.trim() && (
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          )}
        </div>
      </details>
    </>
  );
}
