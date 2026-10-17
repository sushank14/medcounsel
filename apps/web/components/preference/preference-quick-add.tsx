"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Check, LayoutGrid, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INDIAN_STATES } from "@medcounsel/types";

type SearchHit = {
  collegeId: string;
  specialtyId: string;
  collegeName: string;
  state: string;
  degree: string;
  specialtyName: string;
  slug: string;
};

export function PreferenceQuickAdd({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [degree, setDegree] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const search = useCallback(async () => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (state) params.set("state", state);
      if (degree) params.set("degree", degree);
      const res = await fetch(`/api/preferences/quick-search?${params}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, state, degree]);

  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addHit = async (hit: SearchHit) => {
    const key = `${hit.collegeId}|${hit.specialtyId}`;
    setMessage("");
    const res = await fetch("/api/preferences/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collegeId: hit.collegeId,
        specialtyId: hit.specialtyId,
        fitSnapshot: { source: "quick-search" },
      }),
    });
    if (res.status === 409) {
      setAddedKeys((prev) => new Set(prev).add(key));
      setMessage("Already in your list.");
      return;
    }
    if (!res.ok) {
      setMessage("Could not add — try signing in again.");
      return;
    }
    setAddedKeys((prev) => new Set(prev).add(key));
    setMessage(`Added ${hit.degree} ${hit.specialtyName}.`);
    onAdded();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href="/seat-matrix?source=mcc&year=2026"
          className="card flex items-start gap-3 p-3 transition hover:border-brand-300 hover:shadow-sm"
        >
          <Table2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Seat matrix filters</p>
            <p className="text-xs text-slate-500">Filter by state & branch, bulk-add matches</p>
          </div>
        </Link>
        <Link
          href="/my-chances"
          className="card flex items-start gap-3 p-3 transition hover:border-brand-300 hover:shadow-sm"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">My Chances</p>
            <p className="text-xs text-slate-500">Add colleges matched to your rank</p>
          </div>
        </Link>
        <Link
          href="/colleges"
          className="card flex items-start gap-3 p-3 transition hover:border-brand-300 hover:shadow-sm"
        >
          <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium">Browse colleges</p>
            <p className="text-xs text-slate-500">Open a college page and add courses</p>
          </div>
        </Link>
      </div>

      <div className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-900">Quick search & add</p>
        <p className="text-xs text-slate-500">Type a college or city name — pick a course to add in one tap.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Jalgaon, KEM, Bangalore…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-sm"
            aria-label="State filter"
          >
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-sm"
            aria-label="Degree filter"
          >
            <option value="">MD / MS / all</option>
            {["MD", "MS", "DNB", "DIPLOMA"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {message && <p className="text-sm text-brand-700">{message}</p>}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="text-sm text-slate-400">Enter at least 2 characters to search.</p>
          ) : loading ? (
            <p className="text-sm text-slate-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-500">No courses found — try another spelling or state.</p>
          ) : (
            results.map((hit) => {
              const key = `${hit.collegeId}|${hit.specialtyId}`;
              const added = addedKeys.has(key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {hit.degree} {hit.specialtyName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {hit.collegeName} · {hit.state}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? "secondary" : "outline"}
                    disabled={added}
                    className="shrink-0 gap-1"
                    onClick={() => addHit(hit)}
                  >
                    {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {added ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
