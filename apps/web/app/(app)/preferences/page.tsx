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

  if (loading) return <p className="text-slate-500">Loading preference list...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My choice list</h1>
        <p className="text-slate-600">
          {list?.title ?? "2026 Preference List"} — order = MCC priority (1 = first choice).
        </p>
      </div>

      <DisclaimerBanner compact />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-slate-50 p-1">
          <button
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              tab === "list" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setTab("list")}
          >
            My list ({count})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              tab === "add" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setTab("add")}
          >
            Add choices
          </button>
        </div>
        {count > 0 && tab === "list" && (
          <>
            <Button variant="outline" size="sm" onClick={copyList}>
              {copied ? "Copied!" : "Copy list"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportList}>
              Export .txt
            </Button>
            <Button variant="outline" size="sm" disabled={optimizing} onClick={() => runOptimize(false)}>
              {optimizing ? "Working…" : "Smart order preview"}
            </Button>
            <Button size="sm" disabled={optimizing} onClick={() => runOptimize(true)}>
              Apply smart order
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={clearAll}>
              Clear all
            </Button>
            <Link href="/onboarding">
              <Button variant="ghost" size="sm">
                Edit priorities
              </Button>
            </Link>
          </>
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
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">From your rank (My Chances)</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.slice(0, 8).map((s) => (
              <div key={`${s.collegeId}-${s.specialtyId}`} className="card flex items-center justify-between p-3">
                <div className="min-w-0 pr-2">
                  <p className="truncate text-sm font-medium">
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
          <Link href="/my-chances" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
            See all matches →
          </Link>
        </div>
      )}

      {tab === "list" && (
        <>
          {optimizePreview && (
            <div className="card border-brand-200 bg-brand-50/50 p-4 text-sm">
              <p className="font-medium text-brand-900">Suggested order preview</p>
              <p className="mt-1 text-brand-800/80">
                Based on priorities: {prioritiesUsed.join(" → ")}. Click Apply smart order to use it.
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
                {optimizePreview.map((row) => (
                  <li key={row.id}>
                    <span className="font-medium">
                      {row.specialtyLabel} — {row.collegeName}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">{row.explanation}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {count === 0 ? (
            <div className="card space-y-4 p-8 text-center">
              <p className="text-lg font-medium text-slate-800">Start your list in under a minute</p>
              <ol className="mx-auto max-w-md space-y-2 text-left text-sm text-slate-600">
                <li>
                  <strong>1.</strong> Open <button type="button" className="text-brand-600 underline" onClick={() => setTab("add")}>Add choices</button> and search a college, or use Seat Matrix filters.
                </li>
                <li>
                  <strong>2.</strong> Tap <strong>Add</strong> on each course you want.
                </li>
                <li>
                  <strong>3.</strong> Return here and drag or use ↑↓ to set priority order.
                </li>
              </ol>
              <Button onClick={() => setTab("add")}>Add my first choice</Button>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs text-slate-500">
                Drag the handle or use arrow buttons to reorder. Top = choice #1 for counselling.
              </p>
              <ChoiceListEditor
                items={itemsWithNotes}
                onReorder={bulkReorder}
                onRemove={removeItem}
                reordering={reordering}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
