"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ListPlus, Check, ExternalLink } from "lucide-react";
import type { SeatMatrixSearchParams } from "@/lib/seat-matrix-filters";

export type FilterChip = { label: string; value: string };

export function SeatMatrixAddToPreferences({
  filters,
  filterChips,
  allMatchingCourses,
  pageCourseCount,
  page,
  pageSize,
  disabled,
}: {
  filters: SeatMatrixSearchParams;
  filterChips: FilterChip[];
  allMatchingCourses: number;
  pageCourseCount: number;
  page: number;
  pageSize: number;
  disabled?: boolean;
}) {
  const [scope, setScope] = useState<"all" | "page">("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  const allAddCount = Math.min(allMatchingCourses, 400);
  const targetCount = scope === "page" ? pageCourseCount : allAddCount;

  const add = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/preferences/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatMatrixFilters: filters,
          scope,
          page,
          pageSize,
          fitSnapshot: { source: "seat-matrix", filters: filterChips },
        }),
      });
      if (res.status === 401) {
        setError("Sign in to save your choice list.");
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setResult({ added: data.added, skipped: data.skipped });
    } catch {
      setError("Could not add to choice list. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-3 border-brand-100 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Build your choice list from filters</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Review your filters below, choose what to add, then send matching college–course pairs to your preference
            list (one entry per college + branch, not per category row).
          </p>
        </div>
        <Link
          href="/preferences"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          Open choice list
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterChips.length === 0 ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
            No filters — entire matrix
          </span>
        ) : (
          filterChips.map((c) => (
            <span
              key={`${c.label}-${c.value}`}
              className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
            >
              <span className="text-slate-500">{c.label}:</span> {c.value}
            </span>
          ))
        )}
      </div>

      <fieldset className="space-y-2 text-sm" disabled={disabled || loading}>
        <legend className="sr-only">What to add</legend>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="pref-scope"
            checked={scope === "all"}
            onChange={() => setScope("all")}
            className="text-brand-600"
          />
          <span>
            All matching courses{" "}
            <strong className="font-medium text-slate-900">({allMatchingCourses.toLocaleString()})</strong>
            {allMatchingCourses >= 400 && (
              <span className="text-xs text-amber-700"> — first 400 unique courses</span>
            )}
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="pref-scope"
            checked={scope === "page"}
            onChange={() => setScope("page")}
            className="text-brand-600"
          />
          <span>
            Current page only{" "}
            <strong className="font-medium text-slate-900">({pageCourseCount.toLocaleString()})</strong>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={disabled || loading || targetCount === 0 || !!result}
          onClick={add}
          className="gap-1.5"
        >
          {result ? <Check className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
          {result ? "Added to choice list" : `Add ${targetCount.toLocaleString()} to preferences`}
        </Button>
        {result && (
          <span className="text-sm text-slate-600">
            {result.added} new · {result.skipped} already in list
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
