"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { FitBadge } from "@/components/prediction/fit-badge";
import { CATEGORY_LABELS } from "@medcounsel/types";
import type { PredictionResult, FitLevel } from "@medcounsel/types";
import { formatRank } from "@/lib/utils";

interface CategoryRow {
  category: string;
  quota: string;
  medianClosing: number;
  fitLevel: FitLevel;
  years: number[];
}

export default function CategoryExplorerPage() {
  const [rank, setRank] = useState("15432");
  const [category, setCategory] = useState("OBC");
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      simulator: "true",
      rank,
      category,
      domicileState: "Maharashtra",
      counsellingPref: "BOTH",
      collegePref: "ANY",
      budgetRange: "NO_RESTRICTION",
    });
    const res = await fetch(`/api/predictions?${params}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setSelected(null);
    setCategoryRows([]);
    setLoading(false);
  };

  const loadCategoryBreakdown = async (result: PredictionResult) => {
    setSelected(result);
    const params = new URLSearchParams({
      collegeId: result.collegeId,
      specialtyId: result.specialtyId,
      counsellingCode: result.counsellingCode,
      rank,
    });
    const res = await fetch(`/api/category-compare?${params}`);
    const data = await res.json();
    setCategoryRows(data.comparison ?? []);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="space-y-2">
          <h1 className="page-title">Category & Quota Explorer</h1>
          <p className="page-lead">
            See how previous-year cutoffs differ by caste/category and quota for each college + branch
          </p>
        </div>
      </header>

      <DisclaimerBanner compact />

      <div className="card card-body grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Your NEET-PG Rank</Label>
          <Input type="number" value={rank} onChange={(e) => setRank(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Your Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={run} disabled={loading}>
            {loading ? "Analysing..." : "Find options for my category"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">
            Options for {CATEGORY_LABELS[category] ?? category} ({results.length})
          </h2>
          <div className="max-h-[700px] space-y-3 overflow-y-auto">
            {results.slice(0, 15).map((r) => (
              <button
                key={`${r.collegeId}-${r.specialtyId}-${r.counsellingCode}`}
                type="button"
                onClick={() => loadCategoryBreakdown(r)}
                className={`w-full rounded-xl border p-3 text-left transition hover:shadow-md ${
                  selected?.collegeId === r.collegeId && selected?.specialtyId === r.specialtyId
                    ? "border-brand-500 bg-brand-50"
                    : "bg-white"
                }`}
              >
                <p className="font-medium">{r.degree} {r.specialtyName}</p>
                <p className="text-sm text-slate-600">{r.collegeName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <FitBadge fitLevel={r.fitLevel} />
                  <span className="text-xs text-slate-500">
                    Median {formatRank(r.statistics.median, r.rankType)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {selected ? (
            <div className="space-y-4">
              <h2 className="font-semibold">
                All categories: {selected.degree} {selected.specialtyName}
              </h2>
              <p className="text-sm text-slate-600">{selected.collegeName} · {selected.counsellingCode}</p>
              <p className="text-xs text-slate-500">
                Click a row to see how your rank {formatRank(parseInt(rank, 10))} compares across categories
              </p>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-500">
                      <th className="p-3">Category</th>
                      <th className="p-3">Quota</th>
                      <th className="p-3">Median Closing</th>
                      <th className="p-3">Years</th>
                      <th className="p-3">Your Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map((row) => (
                      <tr key={row.category} className={`border-b ${row.category === category ? "bg-brand-50" : ""}`}>
                        <td className="p-3 font-medium">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                        <td className="p-3">{row.quota}</td>
                        <td className="p-3">{formatRank(row.medianClosing)}</td>
                        <td className="p-3 text-xs">{row.years.join(", ")}</td>
                        <td className="p-3"><FitBadge fitLevel={row.fitLevel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PredictionCard result={selected} />
            </div>
          ) : (
            <div className="card flex h-64 items-center justify-center p-6 text-center text-slate-500">
              Select a college + branch to see category-wise cutoff comparison
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
