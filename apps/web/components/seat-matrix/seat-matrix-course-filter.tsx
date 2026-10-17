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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search branch name…"
          className={`${fieldInput} w-full`}
          aria-label="Search courses"
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Select one or more branches. Leave all unchecked to include every course.
        </p>
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
                  name="course"
                  value={o.slug}
                  checked={checked.has(o.slug)}
                  onChange={(e) => toggle(o.slug, e.target.checked)}
                  className="mt-1 shrink-0"
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
