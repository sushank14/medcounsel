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

  /** Selected branches that are not in the current search results (still applied on submit). */
  const selectedOffScreen = useMemo(
    () =>
      Array.from(checked)
        .filter((slug) => !filtered.some((o) => o.slug === slug))
        .map((slug) => optionsBySlug.get(slug) ?? { slug, label: slug }),
    [checked, filtered, optionsBySlug]
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
        {/* Hidden fields so every selected branch submits even when filtered out of the list */}
        {Array.from(checked).map((slug) => (
          <input key={`course-${slug}`} type="hidden" name="course" value={slug} />
        ))}
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
          list — other selections stay active.
        </p>
        {selectedOffScreen.length > 0 && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
            <p className="font-medium">
              {selectedOffScreen.length} selected branch{selectedOffScreen.length === 1 ? "" : "es"} hidden by
              search (still included):
            </p>
            <ul className="mt-1 list-inside list-disc leading-relaxed">
              {selectedOffScreen.slice(0, 8).map((o) => (
                <li key={o.slug}>{o.label}</li>
              ))}
              {selectedOffScreen.length > 8 && <li>…and {selectedOffScreen.length - 8} more</li>}
            </ul>
          </div>
        )}
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No courses match this search.</p>
          ) : (
            filtered.map((o) => (
              <label
                key={o.slug}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  value={o.slug}
                  checked={checked.has(o.slug)}
                  onChange={(e) => toggle(o.slug, e.target.checked)}
                  className="mt-1 shrink-0"
                  aria-label={o.label}
                />
                <span className="leading-snug text-slate-700">{o.label}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
