"use client";

import { useMemo, useState } from "react";

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
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <details
      className="w-full min-w-[240px] flex-[1_1_280px] rounded-lg border border-slate-200 bg-white p-2"
      open={selected.length > 0}
    >
      <summary className="cursor-pointer select-none px-1 py-1 text-sm font-medium text-slate-800">
        {selected.length > 0
          ? `${selected.length} course${selected.length === 1 ? "" : "s"} selected`
          : "Choose course(s) — optional"}
      </summary>
      <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search branch name…"
          className="w-full rounded-md border px-2 py-1.5 text-sm"
          aria-label="Search courses"
        />
        <p className="text-xs text-slate-500">Select one or more branches; leave all unchecked for every course.</p>
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No courses match this search.</p>
          ) : (
            filtered.map((o) => (
              <label
                key={o.slug}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="course"
                  value={o.slug}
                  defaultChecked={selectedSet.has(o.slug)}
                  className="mt-0.5"
                />
                <span>{o.label}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
