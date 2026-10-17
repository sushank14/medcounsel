"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import type { PredictionResult } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";
import Link from "next/link";
import { ChoiceListEditor, type ChoiceListRow } from "@/components/preference/choice-list-editor";
import { PreferenceQuickAdd } from "@/components/preference/preference-quick-add";
import { cn } from "@/lib/utils";
import { sectionCard, sectionHint, sectionTitle } from "@/lib/form-field-classes";

type OptimizePreview = {
  rank: number;
  id: string;
  collegeName: string;
  specialtyLabel: string;
  fitLevel?: string;
  explanation: string;
};

type Tab = "list" | "add";

export default function PreferencesPage() {
  const [list, setList] = useState<{ id: string; title: string; items: ChoiceListRow[] } | null>(null);
  const [suggestions, setSuggestions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [optimizePreview, setOptimizePreview] = useState<OptimizePreview[] | null>(null);
  const [prioritiesUsed, setPrioritiesUsed] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [tab, setTab] = useState<Tab>("list");
  const [copied, setCopied] = useState(false);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setList(data.list);
    return data.list as typeof list;
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/preferences").then((r) => r.json()),
      fetch("/api/predictions").then((r) => r.json()),
    ]).then(([prefData, predData]) => {
      setList(prefData.list);
      setSuggestions((predData.results ?? []).slice(0, 20));
      setLoading(false);
      if ((prefData.list?.items?.length ?? 0) === 0) setTab("add");
    });
  }, []);

  const addItem = async (result: PredictionResult) => {
    await fetch("/api/preferences/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collegeId: result.collegeId,
        specialtyId: result.specialtyId,
        fitSnapshot: {
          fitLevel: result.fitLevel,
          candidateRank: result.candidateRank,
          medianClosing: result.statistics.median,
        },
      }),
    });
    await refreshList();
    setOptimizePreview(null);
    setTab("list");
  };

  const removeItem = async (itemId: string) => {
    await fetch(`/api/preferences/items?id=${itemId}`, { method: "DELETE" });
    await refreshList();
    setOptimizePreview(null);
  };

  const clearAll = async () => {
    if (!list?.items.length) return;
    if (!window.confirm(`Remove all ${list.items.length} choices from your list?`)) return;
    await Promise.all(
      list.items.map((item) => fetch(`/api/preferences/items?id=${item.id}`, { method: "DELETE" }))
    );
    await refreshList();
    setOptimizePreview(null);
  };

  const exportList = () => {
    if (!list?.items.length) return;
    const lines = list.items.map(
      (item, idx) =>
        `${idx + 1}. ${item.specialty.degree} ${item.specialty.name} — ${item.college.name}, ${item.college.state}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neet-pg-preference-list.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyList = async () => {
    if (!list?.items.length) return;
    const text = list.items
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.specialty.degree} ${item.specialty.name} — ${item.college.name}, ${item.college.state}`
      )
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bulkReorder = async (orderedIds: string[]) => {
    setReordering(true);
    try {
      await fetch("/api/preferences/items/bulk-reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      await refreshList();
      setOptimizePreview(null);
    } finally {
      setReordering(false);
    }
  };

  const runOptimize = async (apply: boolean) => {
    setOptimizing(true);
    try {
      const res = await fetch("/api/preferences/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Optimize failed");
        return;
      }
      if (apply) {
        setOptimizePreview(null);
        await refreshList();
      } else {
        setOptimizePreview(data.suggested);
        setPrioritiesUsed(data.priorities ?? []);
      }
    } finally {
      setOptimizing(false);
    }
  };

  const itemsWithNotes: ChoiceListRow[] =
    list?.items.map((item) => ({
      ...item,
      optimizeNote: optimizePreview?.find((p) => p.id === item.id)?.explanation,
    })) ?? [];

  const count = list?.items.length ?? 0;

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="space-y-2">
          <h1 className="page-title">My choice list</h1>
          <p className="page-lead">
            {list?.title ?? "2026 Preference List"} · Position <strong>1</strong> is your first counselling choice.
          </p>
        </div>
      </header>

      <DisclaimerBanner compact />

      <div className="space-y-4">
        <div className="inline-flex w-full max-w-md rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 sm:w-auto">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg px-5 py-2.5 text-sm font-medium transition sm:flex-none",
              tab === "list" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setTab("list")}
          >
            My list ({count})
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg px-5 py-2.5 text-sm font-medium transition sm:flex-none",
              tab === "add" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setTab("add")}
          >
            Add choices
          </button>
        </div>

        {count > 0 && tab === "list" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyList}>
                {copied ? "Copied!" : "Copy list"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportList}>
                Export .txt
              </Button>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={optimizing} onClick={() => runOptimize(false)}>
                {optimizing ? "Working…" : "Smart order preview"}
              </Button>
              <Button size="sm" disabled={optimizing} onClick={() => runOptimize(true)}>
                Apply smart order
              </Button>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="flex flex-wrap gap-2">
              <Link href="/onboarding">
                <Button variant="ghost" size="sm">
                  Edit priorities
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          </div>
        )}
      </div>

      {tab === "add" && (
        <PreferenceQuickAdd
          onAdded={async () => {
            await refreshList();
            setTab("list");
          }}
        />
      )}

      {tab === "add" && suggestions.length > 0 && (
        <section className={`${sectionCard} space-y-4`}>
          <div>
            <h2 className={sectionTitle}>From your rank</h2>
            <p className={sectionHint}>Quick picks based on My Chances — tap Add to include them.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.slice(0, 8).map((s) => (
              <div
                key={`${s.collegeId}-${s.specialtyId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {s.degree} {s.specialtyName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{s.collegeName}</p>
                  <p className="text-xs text-slate-400">
                    {formatRank(s.candidateRank, s.rankType)} · Median {formatRank(s.statistics.median, s.rankType)}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => addItem(s)}>
                  Add
                </Button>
              </div>
            ))}
          </div>
          <Link href="/my-chances" className="inline-block text-sm font-medium text-brand-600 hover:underline">
            See all matches →
          </Link>
        </section>
      )}

      {tab === "list" && (
        <div className="space-y-6">
          {optimizePreview && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-5 md:p-6">
              <p className="font-semibold text-brand-900">Suggested order preview</p>
              <p className="mt-2 text-sm leading-relaxed text-brand-900/80">
                Based on priorities: {prioritiesUsed.join(" → ")}. Click <strong>Apply smart order</strong> to use it.
              </p>
              <ol className="mt-4 space-y-3 border-t border-brand-200/60 pt-4 text-sm text-slate-700">
                {optimizePreview.map((row) => (
                  <li key={row.id} className="leading-relaxed">
                    <span className="font-medium text-slate-900">
                      {row.specialtyLabel} — {row.collegeName}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">{row.explanation}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {count === 0 ? (
            <div className={`${sectionCard} space-y-6 text-center`}>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-slate-900">Start your list in under a minute</p>
                <p className="text-sm text-slate-500">Three simple steps — no form filling on the MCC portal yet.</p>
              </div>
              <ol className="mx-auto max-w-sm space-y-3 text-left text-sm leading-relaxed text-slate-600">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    1
                  </span>
                  <span>
                    Open{" "}
                    <button type="button" className="font-medium text-brand-600 underline" onClick={() => setTab("add")}>
                      Add choices
                    </button>{" "}
                    and search, or use Seat Matrix filters.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    2
                  </span>
                  <span>
                    Tap <strong>Add</strong> on each course you want on your list.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    3
                  </span>
                  <span>Drag or use arrows here to set priority — top = choice #1.</span>
                </li>
              </ol>
              <Button size="lg" className="px-8" onClick={() => setTab("add")}>
                Add my first choice
              </Button>
            </div>
          ) : (
            <section className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-500">
                Drag the handle or use the arrow buttons to reorder. Top row = highest priority for counselling.
              </p>
              <ChoiceListEditor
                items={itemsWithNotes}
                onReorder={bulkReorder}
                onRemove={removeItem}
                reordering={reordering}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
