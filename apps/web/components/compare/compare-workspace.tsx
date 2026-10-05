"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { displayCollegeName, formatCollegeLocation, COLLEGE_TYPE_LABELS } from "@medcounsel/types";
import { formatCurrency, formatRank } from "@/lib/utils";
import { FitBadge } from "@/components/prediction/fit-badge";
import type { PredictionResult } from "@medcounsel/types";
import { X } from "lucide-react";

const STORAGE_KEY = "medcounsel-compare-v1";
const MAX = 3;

type CompareSlot = {
  collegeId: string;
  specialtyId: string;
  result?: PredictionResult;
};

export function CompareWorkspace({
  initialItems,
  hasProfile,
}: {
  initialItems: Array<{ collegeId: string; specialtyId: string }>;
  hasProfile: boolean;
}) {
  const [slots, setSlots] = useState<CompareSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPredictions = useCallback(async (items: CompareSlot[]) => {
    if (!items.length) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/predictions?limit=200");
    const data = await res.json();
    const results: PredictionResult[] = data.results ?? [];
    setSlots(
      items.map((item) => ({
        ...item,
        result: results.find(
          (r) => r.collegeId === item.collegeId && r.specialtyId === item.specialtyId
        ),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    let items: CompareSlot[] = [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) items = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    for (const init of initialItems) {
      if (!items.some((i) => i.collegeId === init.collegeId && i.specialtyId === init.specialtyId)) {
        items = [...items, init].slice(0, MAX);
      }
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    loadPredictions(items);
  }, [initialItems, loadPredictions]);

  const remove = (idx: number) => {
    const next = slots.filter((_, i) => i !== idx);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(({ collegeId, specialtyId }) => ({ collegeId, specialtyId }))));
    setSlots(next);
  };

  const clear = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSlots([]);
  };

  if (loading) return <p className="text-slate-500">Loading comparison...</p>;

  if (!hasProfile) {
    return (
      <div className="card p-6 text-center text-slate-600">
        <p>Complete your profile to see fit levels and cutoffs in comparison.</p>
        <a href="/onboarding" className="mt-3 inline-block text-brand-600 hover:underline">
          Set up profile →
        </a>
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p>No colleges to compare yet.</p>
        <p className="mt-2 text-sm">Open My Chances and click Compare on any option.</p>
      </div>
    );
  }

  const rows: Array<{ label: string; values: (string | ReactNode)[] }> = [
    {
      label: "Course",
      values: slots.map((s) =>
        s.result ? `${s.result.degree} ${s.result.specialtyName}` : "—"
      ),
    },
    {
      label: "College",
      values: slots.map((s) => s.result?.collegeName ?? "—"),
    },
    {
      label: "Location",
      values: slots.map((s) =>
        s.result ? `${s.result.city}, ${s.result.state}` : "—"
      ),
    },
    {
      label: "Type",
      values: slots.map((s) =>
        s.result ? COLLEGE_TYPE_LABELS[s.result.collegeType] ?? s.result.collegeType : "—"
      ),
    },
    {
      label: "Counselling",
      values: slots.map((s) => s.result?.counsellingCode ?? "—"),
    },
    {
      label: "Fit",
      values: slots.map((s) =>
        s.result ? <FitBadge key={s.collegeId} fitLevel={s.result.fitLevel} /> : "—"
      ),
    },
    {
      label: "Your rank",
      values: slots.map((s) =>
        s.result ? formatRank(s.result.candidateRank, s.result.rankType) : "—"
      ),
    },
    {
      label: "Median closing",
      values: slots.map((s) =>
        s.result ? formatRank(s.result.statistics.median, s.result.rankType) : "—"
      ),
    },
    {
      label: "Seats",
      values: slots.map((s) =>
        s.result?.seatCount ? String(s.result.seatCount) : "Unavailable"
      ),
    },
    {
      label: "Annual fee",
      values: slots.map((s) =>
        s.result?.fees
          ? `${formatCurrency(s.result.fees.totalAnnual)}${s.result.fees.isEstimate ? " (est.)" : ""}`
          : "Unavailable"
      ),
    },
    {
      label: "Stipend",
      values: slots.map((s) =>
        s.result?.stipend
          ? `${formatCurrency(s.result.stipend.totalMonthly)}/mo`
          : "Unavailable"
      ),
    },
    {
      label: "Bond",
      values: slots.map((s) =>
        s.result?.bond?.bondAmount
          ? formatCurrency(s.result.bond.bondAmount)
          : "Unavailable"
      ),
    },
    {
      label: "Data",
      values: slots.map((s) =>
        s.result?.dataStatus === "OFFICIAL" ? "✓ Official MCC" : "Historical"
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clear}>
          Clear all
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3 text-left text-slate-500">Field</th>
              {slots.map((s, i) => (
                <th key={i} className="p-3 text-left font-medium">
                  <div className="flex items-start justify-between gap-2">
                    <span>Option {i + 1}</span>
                    <button type="button" onClick={() => remove(i)} aria-label="Remove">
                      <X className="h-4 w-4 text-slate-400 hover:text-slate-700" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="p-3 text-slate-500">{row.label}</td>
                {row.values.map((val, i) => (
                  <td key={i} className="p-3 align-top">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
