"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LookupResult = {
  found: boolean;
  smlRank?: number;
  neetScore?: number;
  category?: string;
  categoryMeritNo?: number;
  candidatureType?: string;
  error?: string;
};

export function SmlLookupForm() {
  const [roll, setRoll] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/maharashtra/sml-lookup?roll=${encodeURIComponent(roll)}`);
      const data = await res.json();
      if (!res.ok) {
        setResult({ found: false, error: data.error ?? "Not found" });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ found: false, error: "Lookup failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <h3 className="font-semibold text-slate-900">Find your Maharashtra SML rank (2026 provisional)</h3>
      <p className="mt-1 text-xs text-slate-600">
        Uses the official state merit list — enter your NEET-PG roll number (11 digits). Names are not stored on
        MedCounsel.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="neet-roll">NEET-PG roll number</Label>
          <input
            id="neet-roll"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            inputMode="numeric"
            placeholder="e.g. 26661126292"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading || roll.replace(/\D/g, "").length < 8}>
          {loading ? "Looking up…" : "Look up SML"}
        </Button>
      </form>
      {result && (
        <div className="mt-3 text-sm">
          {result.error && <p className="text-red-600">{result.error}</p>}
          {result.found && result.smlRank != null && (
            <p className="text-slate-800">
              <span className="font-semibold">State merit rank (SML): {result.smlRank.toLocaleString("en-IN")}</span>
              {result.category && (
                <>
                  {" "}
                  · Category: {result.category}
                  {result.categoryMeritNo != null && (
                    <span className="text-slate-500"> (category merit #{result.categoryMeritNo})</span>
                  )}
                </>
              )}
              {result.neetScore != null && (
                <span className="text-slate-500"> · NEET score {result.neetScore}</span>
              )}
              . Set profile rank type to <strong>SML</strong> and use this number in My Chances for Maharashtra CAP.
            </p>
          )}
          {result.found === false && !result.error && (
            <p className="text-amber-800">Roll not found in the 2026 provisional merit list.</p>
          )}
        </div>
      )}
    </div>
  );
}
