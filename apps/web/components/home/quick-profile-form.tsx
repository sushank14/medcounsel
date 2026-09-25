"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CORE_PRIORITIES,
  INDIAN_STATES,
  normalizePreferredCities,
  normalizePriorities,
} from "@medcounsel/types";
import { CityChipPicker } from "@/components/profile/city-chip-picker";
import { PriorityListEditor } from "@/components/profile/priority-list-editor";

interface ProfileForm {
  rank: string;
  rankType: "AIR" | "SML";
  category: string;
  gender: string;
  domicileState: string;
  counsellingPref: string;
  preferredCities: string[];
  priorityRanking: string[];
}

const empty: ProfileForm = {
  rank: "",
  rankType: "AIR",
  category: "GENERAL",
  gender: "FEMALE",
  domicileState: "Maharashtra",
  counsellingPref: "BOTH",
  preferredCities: [],
  priorityRanking: [...CORE_PRIORITIES],
};

export function QuickProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        if (!r.ok) return;
        const p = await r.json();
        if (p?.rank) {
          setHasProfile(true);
          setForm({
            rank: String(p.rank),
            rankType: p.rankType,
            category: p.category,
            gender: p.gender,
            domicileState: p.domicileState,
            counsellingPref: p.counsellingPref,
            preferredCities: normalizePreferredCities(
              JSON.parse((p.preferredCities as string) || "[]") as string[]
            ),
            priorityRanking: normalizePriorities(
              JSON.parse((p.priorityRanking as string) || "[]") as string[]
            ),
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (goToChances: boolean) => {
    setError(null);
    const rank = parseInt(form.rank, 10);
    if (!rank || rank < 1) {
      setError("Enter your NEET-PG rank.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neetPgYear: 2026,
        rank,
        rankType: form.rankType,
        category: form.category,
        gender: form.gender,
        domicileState: form.domicileState,
        counsellingPref: form.counsellingPref,
        preferredSpecialties: [],
        preferredCities: form.preferredCities,
        collegePref: "ANY",
        budgetRange: "NO_RESTRICTION",
        priorityRanking: form.priorityRanking,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }

    setHasProfile(true);
    router.refresh();
    if (goToChances) router.push("/my-chances");
  };

  if (loading) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">Loading your profile…</div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {hasProfile ? "Your NEET-PG details" : "Enter your NEET-PG details"}
        </h2>
        <p className="text-sm text-slate-500">
          One quick form — then search colleges or see your chances.
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="rank">Your rank</Label>
          <div className="flex gap-2">
            <Input
              id="rank"
              type="number"
              min={1}
              placeholder="e.g. 15197"
              value={form.rank}
              onChange={(e) => setForm({ ...form, rank: e.target.value })}
            />
            <Select
              value={form.rankType}
              onChange={(e) => setForm({ ...form, rankType: e.target.value as "AIR" | "SML" })}
              className="w-28 shrink-0"
            >
              <option value="AIR">AIR</option>
              <option value="SML">SML</option>
            </Select>
          </div>
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
          <Label>Gender</Label>
          <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Domicile state</Label>
          <Select
            value={form.domicileState}
            onChange={(e) => setForm({ ...form, domicileState: e.target.value })}
          >
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Counselling</Label>
          <Select
            value={form.counsellingPref}
            onChange={(e) => setForm({ ...form, counsellingPref: e.target.value })}
          >
            <option value="BOTH">AIQ + Maharashtra</option>
            <option value="AIQ">MCC / AIQ only</option>
            <option value="STATE">Maharashtra state only</option>
          </Select>
        </div>
      </div>

      {form.domicileState === "Maharashtra" && (
        <div className="mt-5 border-t pt-4">
          <Label>Preferred cities (optional)</Label>
          <p className="mb-2 text-xs text-slate-500">
            Tap cities you prefer — colleges there rank higher when Location is a priority.
          </p>
          <CityChipPicker
            selected={form.preferredCities}
            onChange={(preferredCities) => setForm({ ...form, preferredCities })}
          />
        </div>
      )}

      <div className="mt-5 border-t pt-4">
        <Label>What matters most to you?</Label>
        <p className="mb-2 text-xs text-slate-500">
          Drag to reorder — top = most important when sorting your college list.
        </p>
        <PriorityListEditor
          priorities={form.priorityRanking}
          onChange={(priorityRanking) => setForm({ ...form, priorityRanking })}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={saving} onClick={() => save(true)}>
          {saving ? "Saving…" : "Save & see my chances →"}
        </Button>
        <Button variant="outline" disabled={saving} onClick={() => save(false)}>
          Save only
        </Button>
        <Link href="/onboarding" className="self-center text-sm text-brand-600 hover:underline">
          More options (specialty, budget…)
        </Link>
      </div>
    </div>
  );
}
