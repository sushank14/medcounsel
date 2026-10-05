"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import type { PredictionResult } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";
import Link from "next/link";
import { ChoiceListEditor, type ChoiceListRow } from "@/components/preference/choice-list-editor";

type OptimizePreview = {
  rank: number;
  id: string;
  collegeName: string;
  specialtyLabel: string;
  fitLevel?: string;
  explanation: string;
};

export default function PreferencesPage() {
  const [list, setList] = useState<{ id: string; title: string; items: ChoiceListRow[] } | null>(null);
  const [suggestions, setSuggestions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [optimizePreview, setOptimizePreview] = useState<OptimizePreview[] | null>(null);
  const [prioritiesUsed, setPrioritiesUsed] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);

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
  };

  const removeItem = async (itemId: string) => {
    await fetch(`/api/preferences/items?id=${itemId}`, { method: "DELETE" });
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

  if (loading) return <p className="text-slate-500">Loading preference list...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build My Choice List</h1>
        <p className="text-slate-600">{list?.title ?? "2026 Preference List"} — drag to set MCC priority</p>
        <p className="mt-1 text-sm text-slate-500">
          Add from{" "}
          <Link href="/my-chances" className="text-brand-600 hover:underline">
            My Chances
          </Link>
          . Drag rows to reorder — top = first choice.
        </p>
      </div>

      <DisclaimerBanner compact />

      {list && list.items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            Export (.txt)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={optimizing}
            onClick={() => runOptimize(false)}
          >
            {optimizing ? "Working…" : "Preview optimized order"}
          </Button>
          <Button size="sm" disabled={optimizing} onClick={() => runOptimize(true)}>
            Apply optimized order
          </Button>
          <Link href="/onboarding">
            <Button variant="ghost" size="sm">
              Edit priorities
            </Button>
          </Link>
        </div>
      )}

      {optimizePreview && (
        <div className="card border-brand-200 bg-brand-50/50 p-4 text-sm">
          <p className="font-medium text-brand-900">Suggested order preview</p>
          <p className="mt-1 text-brand-800/80">
            Based on priorities: {prioritiesUsed.join(" → ")}. Review below, then click Apply optimized order.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Your choices ({list?.items.length ?? 0})</h2>
          {list?.items.length === 0 ? (
            <div className="card p-6 text-center text-slate-500">
              No preferences yet. Add from suggestions →
            </div>
          ) : (
            <ChoiceListEditor
              items={itemsWithNotes}
              onReorder={bulkReorder}
              onRemove={removeItem}
              reordering={reordering}
            />
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Add from suggestions</h2>
          <div className="max-h-[600px] space-y-2 overflow-y-auto">
            {suggestions.map((s) => (
              <div key={`${s.collegeId}-${s.specialtyId}`} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">
                    {s.degree} {s.specialtyName}
                  </p>
                  <p className="text-xs text-slate-500">{s.collegeName}</p>
                  <p className="text-xs text-slate-400">
                    {formatRank(s.candidateRank, s.rankType)} · Median{" "}
                    {formatRank(s.statistics.median, s.rankType)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addItem(s)}>
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
