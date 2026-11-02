"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LookupResponse = {
  air: number;
  smlRank: number;
  found: boolean;
  estimated: boolean;
  category?: string;
  neetScore?: number;
  neighbors?: { lower: { air: number; smlRank: number }; upper: { air: number; smlRank: number } };
  source?: { year: number; listLabel: string; sourceUrl: string; totalCandidates: number };
  disclaimer?: string;
  error?: string;
};

export function AirSmlExplorer(props: { initialAir?: number; initialCategory?: string }) {
  const [air, setAir] = useState(props.initialAir ? String(props.initialAir) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runLookup = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/maharashtra/air-sml?air=${encodeURIComponent(air.trim())}`);
      const json = (await res.json()) as LookupResponse;
      if (!res.ok) {
        setError(json.error ?? "Lookup failed");
        return;
      }
      setResult(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [air]);

  return (
    <section className="card card-body section-block">
      <h2 className="text-lg font-semibold">Look up SML from AIR</h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter your NEET PG All India Rank (AIR). We match against the official registered-candidate list, or
        interpolate between the nearest published AIRs (clearly labelled).
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="air-input">NEET PG AIR</Label>
          <Input
            id="air-input"
            inputMode="numeric"
            placeholder="e.g. 15197"
            value={air}
            onChange={(e) => setAir(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button type="button" onClick={runLookup} disabled={loading || !air.trim()}>
          {loading ? "Looking up…" : "Find SML"}
        </Button>
      </div>

      {props.initialCategory && (
        <p className="mt-2 text-xs text-slate-500">
          Profile category: {props.initialCategory} — seat predictions still use category-specific cutoffs on My
          Chances.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && !error && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-lg font-semibold text-slate-900">
            SML ≈{" "}
            <span className="font-mono">{result.smlRank.toLocaleString("en-IN")}</span>
            {result.found ? (
              <span className="ml-2 text-sm font-normal text-emerald-700">(exact in official list)</span>
            ) : result.estimated ? (
              <span className="ml-2 text-sm font-normal text-amber-700">(estimated)</span>
            ) : null}
          </p>
          {result.category && (
            <p className="mt-1 text-slate-600">
              Category in list: <strong>{result.category}</strong>
              {result.neetScore != null && (
                <>
                  {" "}
                  · NEET score: <span className="font-mono">{result.neetScore}</span>
                </>
              )}
            </p>
          )}
          {result.neighbors && !result.found && (
            <p className="mt-2 text-xs text-slate-500">
              Bracket: AIR {result.neighbors.lower.air.toLocaleString("en-IN")} (SML{" "}
              {result.neighbors.lower.smlRank}) — AIR {result.neighbors.upper.air.toLocaleString("en-IN")} (SML{" "}
              {result.neighbors.upper.smlRank})
            </p>
          )}
          {result.source && (
            <p className="mt-2 text-xs text-slate-500">
              Source: {result.source.year} {result.source.listLabel} ·{" "}
              <a href={result.source.sourceUrl} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                Official PDF
              </a>
            </p>
          )}
          {result.disclaimer && <p className="mt-3 text-xs text-slate-500">{result.disclaimer}</p>}
        </div>
      )}
    </section>
  );
}
