"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import { cn, formatRank } from "@/lib/utils";
import type { PredictionResult } from "@medcounsel/types";
import {
  CORE_PRIORITIES,
  INDIAN_STATES,
  MAHARASHTRA_CITIES,
  SPECIALTY_OPTIONS,
  DEGREE_OPTIONS,
  specialtiesForDegree,
  normalizePriorities,
  type DegreeFilter,
} from "@medcounsel/types";
import { CityChipPicker } from "@/components/profile/city-chip-picker";
import { PriorityListEditor } from "@/components/profile/priority-list-editor";
import { Pencil, SlidersHorizontal, X } from "lucide-react";

export interface ProfileSnapshot {
  rank: number;
  rankType: "AIR" | "SML";
  category: string;
  domicileState: string;
  counsellingPref: string;
  collegePref: string;
  degreePref: DegreeFilter;
  budgetRange: string;
  preferredSpecialties: string[];
  preferredCities: string[];
  priorityRanking: string[];
}

interface SearchFilters extends ProfileSnapshot {
  stateFilter: string;
  cityFilter: string;
  counsellingCode: string;
  fitFilter: string;
  specialtyQuery: string;
}

const FIT_OPTIONS = [
  { label: "All fits", value: "" },
  { label: "🟢 Strong", value: "STRONG" },
  { label: "🟡 Possible", value: "POSSIBLE" },
  { label: "🟠 Borderline", value: "BORDERLINE" },
  { label: "🔴 Difficult", value: "DIFFICULT" },
];

function buildInitialFilters(profile: ProfileSnapshot, fitFilter = ""): SearchFilters {
  return {
    ...profile,
    stateFilter: "",
    cityFilter: "",
    counsellingCode: "",
    fitFilter,
    specialtyQuery: "",
  };
}

export function MyChancesSearch({
  profile,
  initialFitFilter = "",
  initialResults,
}: {
  profile: ProfileSnapshot;
  initialFitFilter?: string;
  initialResults?: PredictionResult[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPriorities, setSavingPriorities] = useState(false);
  const [results, setResults] = useState<PredictionResult[]>(initialResults ?? []);
  const [hasSearched, setHasSearched] = useState(!!initialResults?.length);

  const [draft, setDraft] = useState<SearchFilters>(() =>
    buildInitialFilters(profile, initialFitFilter)
  );
  const [applied, setApplied] = useState<SearchFilters>(() =>
    buildInitialFilters(profile, initialFitFilter)
  );

  const updateDraft = (key: keyof SearchFilters, value: string | number) =>
    setDraft((f) => ({ ...f, [key]: value }));

  const runSearch = useCallback(async (f: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        simulator: "true",
        rank: String(f.rank),
        rankType: f.rankType,
        category: f.category,
        domicileState: f.domicileState,
        counsellingPref: f.counsellingPref,
        collegePref: f.collegePref,
        budgetRange: f.budgetRange,
      });
      if (f.stateFilter) params.set("state", f.stateFilter);
      if (f.preferredSpecialties.length)
        params.set("specialties", f.preferredSpecialties.join(","));
      if (f.preferredCities.length)
        params.set("cities", f.preferredCities.join(","));
      if (f.cityFilter) params.set("city", f.cityFilter);
      if (f.priorityRanking.length)
        params.set("priorities", f.priorityRanking.join(","));
      if (f.degreePref && f.degreePref !== "ALL") params.set("degree", f.degreePref);

      params.set("limit", "100");
      const res = await fetch(`/api/predictions?${params}`);
      const data = await res.json();
      let list: PredictionResult[] = data.results ?? [];

      if (f.counsellingCode)
        list = list.filter((r) => r.counsellingCode === f.counsellingCode);
      if (f.fitFilter) list = list.filter((r) => r.fitLevel === f.fitFilter);
      if (f.specialtyQuery) {
        const q = f.specialtyQuery.toLowerCase();
        list = list.filter(
          (r) =>
            r.specialtyName.toLowerCase().includes(q) ||
            `${r.degree} ${r.specialtyName}`.toLowerCase().includes(q)
        );
      }

      setResults(list);
      setApplied(f);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const initialSearch = useRef(!!initialResults?.length);

  useEffect(() => {
    if (!initialSearch.current) {
      initialSearch.current = true;
      runSearch(buildInitialFilters(profile, initialFitFilter));
    }
  }, [profile, initialFitFilter, runSearch, initialResults?.length]);

  const openEdit = () => {
    setDraft(applied);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setDraft(applied);
    setEditOpen(false);
  };

  const applyFilters = () => {
    runSearch(draft);
    setEditOpen(false);
  };

  const resetToProfile = () => {
    const reset = buildInitialFilters(profile);
    setDraft(reset);
    runSearch(reset);
    setEditOpen(false);
  };

  const savePriorities = async () => {
    setSavingPriorities(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priorityRanking: draft.priorityRanking,
          preferredCities: draft.preferredCities,
        }),
      });
    } finally {
      setSavingPriorities(false);
    }
  };

  const toggleSpecialty = (s: string) => {
    setDraft((f) => ({
      ...f,
      preferredSpecialties: f.preferredSpecialties.includes(s)
        ? f.preferredSpecialties.filter((x) => x !== s)
        : [...f.preferredSpecialties, s],
    }));
  };

  const activeFitLabel =
    FIT_OPTIONS.find((f) => f.value === applied.fitFilter)?.label ?? "All fits";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analyze My Rank</h1>
          <p className="text-slate-600">
            {hasSearched
              ? `${results.length} options match your applied filters`
              : "Loading your options…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Edit filters
          </Button>
          <Link href="/onboarding">
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-3.5 w-3.5" />
              Full profile edit
            </Button>
          </Link>
        </div>
      </div>

      <DisclaimerBanner compact />

      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
        <span>
          <span className="text-slate-500">Rank</span>{" "}
          <span className="font-medium">{formatRank(applied.rank, applied.rankType)}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="text-slate-500">Category</span>{" "}
          <span className="font-medium">{applied.category}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="text-slate-500">Counselling</span>{" "}
          <span className="font-medium">{applied.counsellingPref}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="text-slate-500">Fit</span>{" "}
          <span className="font-medium">{activeFitLabel}</span>
        </span>
        {!editOpen && (
          <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1 text-brand-600" onClick={openEdit}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Change
          </Button>
        )}
      </div>

      {editOpen && (
        <div className="card space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Edit filters</p>
              <p className="text-sm text-slate-500">
                Adjust criteria below, then click Apply filters. Changes are not applied until you confirm.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={closeEdit} aria-label="Close filters">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Rank</Label>
              <Input
                type="number"
                min={1}
                value={draft.rank}
                onChange={(e) => updateDraft("rank", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label>Rank type</Label>
              <Select value={draft.rankType} onChange={(e) => updateDraft("rankType", e.target.value)}>
                <option value="AIR">AIR (MCC / AIQ)</option>
                <option value="SML">SML (State — Maharashtra)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={draft.category} onChange={(e) => updateDraft("category", e.target.value)}>
                {["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Domicile state</Label>
              <Select value={draft.domicileState} onChange={(e) => updateDraft("domicileState", e.target.value)}>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Counselling</Label>
              <Select value={draft.counsellingPref} onChange={(e) => updateDraft("counsellingPref", e.target.value)}>
                <option value="AIQ">AIQ only</option>
                <option value="STATE">State only</option>
                <option value="BOTH">Both AIQ & State</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Course type</Label>
              <Select value={draft.degreePref} onChange={(e) => updateDraft("degreePref", e.target.value)}>
                {DEGREE_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>College type</Label>
              <Select value={draft.collegePref} onChange={(e) => updateDraft("collegePref", e.target.value)}>
                <option value="ANY">Any</option>
                <option value="GOVT_ONLY">Government only (GMCs, AIIMS)</option>
                <option value="GOVT_PRIVATE">Govt + Private (incl. DNB hospitals)</option>
                <option value="CENTRAL">Central</option>
                <option value="PRIVATE">Private</option>
                <option value="DEEMED">Deemed</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Budget</Label>
              <Select value={draft.budgetRange} onChange={(e) => updateDraft("budgetRange", e.target.value)}>
                <option value="NO_RESTRICTION">No restriction</option>
                <option value="UNDER_5L">Under ₹5L/yr</option>
                <option value="RANGE_5_10L">₹5–10L/yr</option>
                <option value="RANGE_10_20L">₹10–20L/yr</option>
                <option value="RANGE_20_50L">₹20–50L/yr</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>College state filter</Label>
              <Select value={draft.stateFilter} onChange={(e) => updateDraft("stateFilter", e.target.value)}>
                <option value="">All states</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>City filter</Label>
              <Select value={draft.cityFilter} onChange={(e) => updateDraft("cityFilter", e.target.value)}>
                <option value="">All cities</option>
                {MAHARASHTRA_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Counselling quota filter</Label>
              <Select value={draft.counsellingCode} onChange={(e) => updateDraft("counsellingCode", e.target.value)}>
                <option value="">All (AIQ + State)</option>
                <option value="AIQ">AIQ only (AIR ranks)</option>
                <option value="MAHARASHTRA">Maharashtra only (SML ranks)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Branch search</Label>
              <Input
                placeholder="e.g. Radiology, Medicine"
                value={draft.specialtyQuery}
                onChange={(e) => updateDraft("specialtyQuery", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium text-slate-700">Filter by fit</p>
            <p className="mt-1 text-xs text-slate-500">Select a fit level, then apply filters below.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FIT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateDraft("fitFilter", f.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    draft.fitFilter === f.value
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Your priorities</summary>
            <p className="mt-2 text-xs text-slate-500">
              Drag items to reorder — top = most important. Applied when you click Apply filters.
            </p>
            <div className="mt-3">
              <PriorityListEditor
                priorities={draft.priorityRanking}
                onChange={(priorityRanking) =>
                  setDraft((f) => ({ ...f, priorityRanking }))
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((f) => ({ ...f, priorityRanking: [...CORE_PRIORITIES] }))
                }
              >
                Reset to default
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingPriorities}
                onClick={savePriorities}
              >
                {savingPriorities ? "Saving..." : "Save to profile"}
              </Button>
            </div>
          </details>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Preferred cities (optional)</summary>
            <p className="mt-2 text-xs text-slate-500">
              Colleges in selected cities rank higher when Location is a priority.
            </p>
            <div className="mt-3">
              <CityChipPicker
                selected={draft.preferredCities}
                onChange={(preferredCities) => setDraft((f) => ({ ...f, preferredCities }))}
              />
            </div>
          </details>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Preferred specialties (optional)</summary>
            <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {specialtiesForDegree(draft.degreePref).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.preferredSpecialties.includes(s)}
                    onChange={() => toggleSpecialty(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={applyFilters} disabled={loading || !draft.rank}>
              {loading ? "Applying..." : "Apply filters"}
            </Button>
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button variant="outline" onClick={resetToProfile}>
              Reset to saved profile
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="card p-8 text-center text-slate-500">Loading options...</div>
      )}

      {!loading && hasSearched && results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((r) => (
            <PredictionCard key={`${r.collegeId}-${r.specialtyId}-${r.counsellingCode}`} result={r} />
          ))}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p className="font-medium">No options match these filters</p>
          <p className="mt-2 text-sm">Try a wider rank range, set college type to &quot;Any&quot;, or clear specialty filters.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openEdit}>
            Edit filters
          </Button>
        </div>
      )}
    </div>
  );
}
