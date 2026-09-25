"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import type { PredictionResult } from "@medcounsel/types";
import { DEGREE_OPTIONS, INDIAN_STATES, SPECIALTY_OPTIONS } from "@medcounsel/types";

export default function SimulatorPage() {
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    rank: "15432",
    rankType: "AIR",
    category: "GENERAL",
    domicileState: "Maharashtra",
    counsellingPref: "BOTH",
    collegePref: "ANY",
    degreePref: "ALL",
    budgetRange: "NO_RESTRICTION",
    state: "",
    specialties: "",
  });

  const run = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      simulator: "true",
      rank: form.rank,
      rankType: form.rankType,
      category: form.category,
      domicileState: form.domicileState,
      counsellingPref: form.counsellingPref,
      collegePref: form.collegePref,
      budgetRange: form.budgetRange,
      ...(form.degreePref && form.degreePref !== "ALL" ? { degree: form.degreePref } : {}),
      ...(form.state ? { state: form.state } : {}),
      ...(form.specialties ? { specialties: form.specialties } : {}),
    });
    const res = await fetch(`/api/predictions?${params}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">What-If Simulator</h1>
        <p className="text-slate-600">Change parameters and see how your options shift — same engine as My Chances</p>
      </div>

      <DisclaimerBanner compact />

      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label>What if my rank is...</Label>
          <Input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} type="number" />
        </div>
        <div className="space-y-1">
          <Label>Rank type</Label>
          <Select value={form.rankType} onChange={(e) => setForm({ ...form, rankType: e.target.value })}>
            <option value="AIR">AIR (MCC / AIQ)</option>
            <option value="SML">SML (Maharashtra state)</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Domicile</Label>
          <Select value={form.domicileState} onChange={(e) => setForm({ ...form, domicileState: e.target.value })}>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Counselling</Label>
          <Select value={form.counsellingPref} onChange={(e) => setForm({ ...form, counsellingPref: e.target.value })}>
            <option value="AIQ">MCC / AIQ only</option>
            <option value="STATE">Maharashtra state only</option>
            <option value="BOTH">Both AIQ + Maharashtra</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Course type</Label>
          <Select value={form.degreePref} onChange={(e) => setForm({ ...form, degreePref: e.target.value })}>
            {DEGREE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>College type</Label>
          <Select value={form.collegePref} onChange={(e) => setForm({ ...form, collegePref: e.target.value })}>
            <option value="GOVT_ONLY">Government only</option>
            <option value="GOVT_PRIVATE">Govt + Private</option>
            <option value="DEEMED">Deemed only</option>
            <option value="ANY">Any</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Budget</Label>
          <Select value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}>
            <option value="UNDER_5L">Under ₹5L</option>
            <option value="RANGE_5_10L">₹5–10L</option>
            <option value="RANGE_10_20L">₹10–20L</option>
            <option value="NO_RESTRICTION">No restriction</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>State filter</Label>
          <Select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Specialty filter (comma-separated)</Label>
          <Input
            value={form.specialties}
            onChange={(e) => setForm({ ...form, specialties: e.target.value })}
            placeholder="e.g. Radiodiagnosis, General Medicine"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? "Simulating..." : "Run simulation"}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div>
          <p className="mb-4 text-sm text-slate-600">{results.length} options found</p>
          <div className="grid gap-4 md:grid-cols-2">
            {results.slice(0, 20).map((r) => (
              <PredictionCard key={`${r.collegeId}-${r.specialtyId}-${r.counsellingCode}`} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
