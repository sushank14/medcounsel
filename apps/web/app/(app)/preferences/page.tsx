"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import type { FitLevel, PredictionResult } from "@medcounsel/types";
import { displayCollegeName, formatCollegeLocation } from "@medcounsel/types";
import { formatRank, formatCurrency } from "@/lib/utils";
import { FitBadge } from "@/components/prediction/fit-badge";
import { fitLevelToTier, CHOICE_TIER_LABELS } from "@medcounsel/types";
import Link from "next/link";

interface PrefItem {
  id: string;
  sortOrder: number;
  college: { name: string; slug: string; city: string; state: string };
  specialty: { name: string; degree: string };
  fitSnapshot: string;
}

export default function PreferencesPage() {
  const [list, setList] = useState<{ id: string; title: string; items: PrefItem[] } | null>(null);
  const [suggestions, setSuggestions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);

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
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setList(data.list);
  };

  const removeItem = async (itemId: string) => {
    await fetch(`/api/preferences/items?id=${itemId}`, { method: "DELETE" });
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setList(data.list);
  };

  const exportList = () => {
    if (!list?.items.length) return;
    const lines = list.items.map((item, idx) =>
      `${idx + 1}. ${item.specialty.degree} ${item.specialty.name} — ${displayCollegeName(item.college.name)}, ${item.college.state}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neet-pg-preference-list.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    await fetch("/api/preferences/items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, direction }),
    });
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setList(data.list);
  };

  if (loading) return <p className="text-slate-500">Loading preference list...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build My Choice List</h1>
        <p className="text-slate-600">{list?.title ?? "2026 Preference List"} — drag order = MCC priority</p>
        <p className="mt-1 text-sm text-slate-500">
          Add from suggestions or any option in{" "}
          <Link href="/my-chances" className="text-brand-600 hover:underline">My Chances</Link>.
          Use ↑↓ to reorder — top choice first.
        </p>
      </div>

      <DisclaimerBanner compact />

      {list && list.items.length > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            Export preference list (.txt)
          </Button>
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
            <div className="space-y-2">
              {list?.items.map((item, idx) => {
                const fit = JSON.parse(item.fitSnapshot || "{}") as { fitLevel?: string };
                const tier = fit.fitLevel ? fitLevelToTier(fit.fitLevel) : null;
                return (
                  <div key={item.id} className="card flex items-start gap-3 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{item.specialty.degree} {item.specialty.name}</p>
                      <p className="text-sm text-slate-600">{displayCollegeName(item.college.name)}</p>
                      <p className="text-xs text-slate-400">{formatCollegeLocation(item.college.city, item.college.state, item.college.name, item.college.slug)}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {fit.fitLevel && <FitBadge fitLevel={fit.fitLevel as FitLevel} />}
                        {tier && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {CHOICE_TIER_LABELS[tier].label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" onClick={() => moveItem(item.id, "up")} disabled={idx === 0}>↑</Button>
                      <Button variant="ghost" size="sm" onClick={() => moveItem(item.id, "down")} disabled={idx === (list?.items.length ?? 0) - 1}>↓</Button>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>✕</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Add from suggestions</h2>
          <div className="max-h-[600px] space-y-2 overflow-y-auto">
            {suggestions.map((s) => (
              <div key={`${s.collegeId}-${s.specialtyId}`} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{s.degree} {s.specialtyName}</p>
                  <p className="text-xs text-slate-500">{s.collegeName}</p>
                  <p className="text-xs text-slate-400">{formatRank(s.candidateRank, s.rankType)} · Median {formatRank(s.statistics.median, s.rankType)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addItem(s)}>Add</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
