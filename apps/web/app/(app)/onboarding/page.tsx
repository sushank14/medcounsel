"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import {
  INDIAN_STATES,
  SPECIALTY_OPTIONS,
  CORE_PRIORITIES,
  DEGREE_OPTIONS,
  specialtiesForDegree,
  normalizePreferredCities,
  normalizePriorities,
  type DegreeFilter,
} from "@medcounsel/types";
import { CityChipPicker } from "@/components/profile/city-chip-picker";
import { PriorityListEditor } from "@/components/profile/priority-list-editor";

const STEPS = [
  "NEET-PG Year",
  "Your Rank",
  "Category",
  "Gender",
  "Domicile State",
  "Counselling",
  "Course (MD/MS/DNB)",
  "Specialties",
  "College Preference",
  "Budget",
  "Priorities",
];

const STORAGE_KEY = "medcounsel-onboarding-draft";

const defaultForm = {
  neetPgYear: "2026",
  rank: "",
  rankType: "AIR" as "AIR" | "SML",
  category: "GENERAL",
  gender: "MALE",
  domicileState: "Maharashtra",
  counsellingPref: "BOTH",
  preferredSpecialties: [] as string[],
  preferredCities: [] as string[],
  collegePref: "ANY",
  degreePref: "ALL" as DegreeFilter,
  budgetRange: "NO_RESTRICTION",
  priorityRanking: [...CORE_PRIORITIES] as string[],
};

function profileToForm(p: Record<string, unknown>) {
  return {
    neetPgYear: String(p.neetPgYear ?? "2026"),
    rank: String(p.rank ?? ""),
    rankType: (p.rankType as "AIR" | "SML") ?? "AIR",
    category: String(p.category ?? "GENERAL"),
    gender: String(p.gender ?? "MALE"),
    domicileState: String(p.domicileState ?? "Maharashtra"),
    counsellingPref: String(p.counsellingPref ?? "BOTH"),
    preferredSpecialties: JSON.parse((p.preferredSpecialties as string) || "[]") as string[],
    preferredCities: normalizePreferredCities(
      JSON.parse((p.preferredCities as string) || "[]") as string[]
    ),
    collegePref: String(p.collegePref ?? "ANY"),
    degreePref: (String(p.degreePref ?? "ALL") as DegreeFilter) || "ALL",
    budgetRange: String(p.budgetRange ?? "NO_RESTRICTION"),
    priorityRanking: normalizePriorities(
      JSON.parse((p.priorityRanking as string) || "[]") as string[]
    ),
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        setAuthed(r.ok);
        if (r.ok) {
          const profile = await r.json();
          if (profile?.rank) {
            setForm(profileToForm(profile));
            return;
          }
        }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setForm({ ...defaultForm, ...JSON.parse(saved) });
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const update = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSpecialty = (s: string) => {
    setForm((f) => ({
      ...f,
      preferredSpecialties: f.preferredSpecialties.includes(s)
        ? f.preferredSpecialties.filter((x) => x !== s)
        : [...f.preferredSpecialties, s],
    }));
  };

  const submit = async () => {
    setLoading(true);
    setError(null);

    const rank = parseInt(form.rank, 10);
    if (!rank || rank < 1) {
      setError("Please enter a valid rank.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rank,
        neetPgYear: parseInt(form.neetPgYear, 10),
      }),
    });

    setLoading(false);

    if (res.status === 401) {
      setError("Please sign in first to save your profile. Your answers are saved locally.");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save profile. Please try again.");
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    router.push("/dashboard");
    router.refresh();
  };

  const next = () => {
    if (step === 1 && !form.rank) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit();
  };

  const showSmlHint =
    form.domicileState === "Maharashtra" &&
    (form.counsellingPref === "STATE" || form.counsellingPref === "BOTH");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-sm text-brand-600">Step {step + 1} of {STEPS.length}</p>
        <h1 className="text-2xl font-bold">{STEPS[step]}</h1>
        <p className="mt-1 text-sm text-slate-500">Your profile — rank, category, gender & state are saved to your account only.</p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {authed === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Sign in required to save your profile</p>
          <p className="mt-1">You can fill this form now — we&apos;ll keep your answers. Sign in before finishing.</p>
          <Link
            href="/login?callbackUrl=/onboarding"
            className="mt-2 inline-block font-medium text-brand-700 underline"
          >
            Sign in →
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          {error.includes("sign in") && (
            <Link href="/login?callbackUrl=/onboarding" className="mt-2 block font-medium underline">
              Go to sign in
            </Link>
          )}
        </div>
      )}

      <div className="card p-6">
        {step === 0 && (
          <div className="space-y-2">
            <Label>NEET-PG Year</Label>
            <Select value={form.neetPgYear} onChange={(e) => update("neetPgYear", e.target.value)}>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </Select>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Rank</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 15432"
                value={form.rank}
                onChange={(e) => update("rank", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rank type</Label>
              <Select
                value={form.rankType}
                onChange={(e) => update("rankType", e.target.value)}
              >
                <option value="AIR">AIR (All India Rank — for MCC/AIQ)</option>
                <option value="SML">SML (State Merit List — for Maharashtra state)</option>
              </Select>
              {showSmlHint && form.rankType === "AIR" && (
                <p className="text-xs text-amber-700">
                  Maharashtra state counselling uses SML ranks. If you have your state rank, select SML.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => update("category", e.target.value)}>
              {["GENERAL", "EWS", "OBC", "SC", "ST", "PWD"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domicile State</Label>
              <Select value={form.domicileState} onChange={(e) => update("domicileState", e.target.value)}>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            {form.domicileState === "Maharashtra" && (
              <div className="space-y-2">
                <Label>Preferred cities (optional)</Label>
                <p className="text-xs text-slate-500">
                  Choose districts/cities you prefer — e.g. Pune, Nagpur, Mumbai.
                </p>
                <CityChipPicker
                  selected={form.preferredCities}
                  onChange={(preferredCities) => update("preferredCities", preferredCities)}
                />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-2">
            <Label>Counselling Preference</Label>
            <Select value={form.counsellingPref} onChange={(e) => update("counsellingPref", e.target.value)}>
              <option value="AIQ">MCC / AIQ only</option>
              <option value="STATE">State counselling only</option>
              <option value="BOTH">Both AIQ and State</option>
            </Select>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-2">
            <Label>Course type</Label>
            <p className="text-xs text-slate-500">
              MD/MS = medical college seats · DNB = NBEMS hospital seats (choose Govt + Private college type to see DNB).
            </p>
            <Select
              value={form.degreePref}
              onChange={(e) => update("degreePref", e.target.value as DegreeFilter)}
            >
              {DEGREE_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-2">
            <Label>Preferred Specialties (optional — leave blank for all)</Label>
            <p className="text-xs text-slate-500">Selecting none shows all specialties you qualify for.</p>
            <div className="grid max-h-60 gap-2 overflow-y-auto">
              {specialtiesForDegree(form.degreePref).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.preferredSpecialties.includes(s)}
                    onChange={() => toggleSpecialty(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-2">
            <Label>College Preference</Label>
            <Select value={form.collegePref} onChange={(e) => update("collegePref", e.target.value)}>
              <option value="GOVT_ONLY">Government only (GMCs, AIIMS — no private hospitals)</option>
              <option value="GOVT_PRIVATE">Government + Private (includes DNB hospitals)</option>
              <option value="DEEMED">Deemed (limited data)</option>
              <option value="CENTRAL">Central universities</option>
              <option value="PRIVATE">Private (limited data)</option>
              <option value="ANY">Any — recommended</option>
            </Select>
            {(form.collegePref === "DEEMED" || form.collegePref === "PRIVATE") && (
              <p className="text-xs text-amber-700">
                Fewer private/deemed colleges in our official dataset — results may be limited.
              </p>
            )}
          </div>
        )}

        {step === 9 && (
          <div className="space-y-2">
            <Label>Annual Budget (tuition + hostel)</Label>
            <Select value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)}>
              <option value="UNDER_5L">Under ₹5 lakh/year</option>
              <option value="RANGE_5_10L">₹5–10 lakh</option>
              <option value="RANGE_10_20L">₹10–20 lakh</option>
              <option value="RANGE_20_50L">₹20–50 lakh</option>
              <option value="ABOVE_50L">₹50 lakh+</option>
              <option value="NO_RESTRICTION">No restriction</option>
            </Select>
          </div>
        )}

        {step === 10 && (
          <div className="space-y-3">
            <div>
              <Label>Your Priorities</Label>
              <p className="text-xs text-slate-500">
                Drag items to reorder — top = most important. We use this to sort suggestions, not to rank colleges politically.
              </p>
            </div>
            <PriorityListEditor
              priorities={form.priorityRanking}
              onChange={(priorityRanking) => update("priorityRanking", priorityRanking)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update("priorityRanking", [...CORE_PRIORITIES])}
            >
              Reset to default order
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
        )}
        <Button
          className="flex-1"
          onClick={next}
          disabled={loading || (step === 1 && !form.rank)}
        >
          {step === STEPS.length - 1 ? (loading ? "Saving..." : "Complete & View Dashboard") : "Continue"}
        </Button>
      </div>

      <DisclaimerBanner compact />
    </div>
  );
}
