"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ListPlus, Check, ExternalLink } from "lucide-react";
import type { SeatMatrixSearchParams } from "@/lib/seat-matrix-filters";
import { sectionCard, sectionHint, sectionTitle } from "@/lib/form-field-classes";
import { cn } from "@/lib/utils";
import { syncChoiceListBackupFromServer } from "@/lib/preference-list-backup";

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
      if (data.added > 0) void syncChoiceListBackupFromServer();
    } catch {
      setError("Could not add to choice list. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${sectionCard} space-y-5 border-brand-100 bg-gradient-to-br from-brand-50/50 to-white`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className={sectionTitle}>Add to choice list</h2>
          <p className={sectionHint}>
            One entry per college + branch (not per category row). Review filters, then bulk-add matches.
          </p>
        </div>
        <Link
          href="/preferences"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          Open choice list
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChips.length === 0 ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
            No filters — entire matrix
          </span>
        ) : (
          filterChips.map((c) => (
            <span
              key={`${c.label}-${c.value}`}
              className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200/80"
            >
              <span className="font-medium text-slate-500">{c.label}</span>{" "}
              <span className="text-slate-800">{c.value}</span>
            </span>
          ))
        )}
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={disabled || loading}>
        <legend className="sr-only">What to add</legend>
        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-xl border p-4 transition",
            scope === "all" ? "border-brand-300 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:border-slate-300"
          )}
        >
          <input
            type="radio"
            name="pref-scope"
            checked={scope === "all"}
            onChange={() => setScope("all")}
            className="mt-0.5 text-brand-600"
          />
          <span className="text-sm leading-relaxed">
            <span className="font-medium text-slate-900">All matching courses</span>
            <span className="mt-0.5 block text-slate-600">
              {allMatchingCourses.toLocaleString()} unique
              {allMatchingCourses >= 400 && " (adds first 400)"}
            </span>
          </span>
        </label>
        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-xl border p-4 transition",
            scope === "page" ? "border-brand-300 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:border-slate-300"
          )}
        >
          <input
            type="radio"
            name="pref-scope"
            checked={scope === "page"}
            onChange={() => setScope("page")}
            className="mt-0.5 text-brand-600"
          />
          <span className="text-sm leading-relaxed">
            <span className="font-medium text-slate-900">This page only</span>
            <span className="mt-0.5 block text-slate-600">{pageCourseCount.toLocaleString()} on current page</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={disabled || loading || targetCount === 0 || !!result}
          onClick={add}
          className="gap-2"
          size="lg"
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
