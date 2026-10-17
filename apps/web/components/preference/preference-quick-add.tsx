"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Check, LayoutGrid, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INDIAN_STATES } from "@medcounsel/types";
import { fieldSelect, sectionCard, sectionHint, sectionTitle } from "@/lib/form-field-classes";

type SearchHit = {
  collegeId: string;
  specialtyId: string;
  collegeName: string;
  state: string;
  degree: string;
  specialtyName: string;
  slug: string;
};

const shortcutLinks = [
  {
    href: "/seat-matrix?source=mcc&year=2026",
    icon: Table2,
    title: "Seat matrix",
    desc: "Filter by state & branch, bulk-add matches",
  },
  {
    href: "/my-chances",
    icon: Sparkles,
    title: "My Chances",
    desc: "Colleges matched to your rank",
  },
  {
    href: "/colleges",
    icon: LayoutGrid,
    title: "Browse colleges",
    desc: "Open a college and add courses",
  },
] as const;

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
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className={sectionTitle}>Other ways to add</h2>
          <p className={sectionHint}>Pick a path that fits how you like to explore colleges.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {shortcutLinks.map(({ href, icon: Icon, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="card flex items-start gap-3 rounded-xl p-4 transition hover:border-brand-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${sectionCard} space-y-5`}>
        <div>
          <h2 className={sectionTitle}>Quick search</h2>
          <p className={sectionHint}>Type a college or city, narrow by state or degree, then add in one tap.</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Jalgaon, KEM, Bangalore…"
            className="h-11 pl-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={`${fieldSelect} w-full`}
              aria-label="State filter"
            >
              <option value="">All states</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Course type</span>
            <select
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              className={`${fieldSelect} w-full`}
              aria-label="Degree filter"
            >
              <option value="">All (MD / MS / DNB)</option>
              {["MD", "MS", "DNB", "DIPLOMA"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">
            {message}
          </p>
        )}

        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2">
          {q.trim().length < 2 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-400">Enter at least 2 characters to search.</p>
          ) : loading ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              No courses found — try another spelling or state.
            </p>
          ) : (
            results.map((hit) => {
              const key = `${hit.collegeId}|${hit.specialtyId}`;
              const added = addedKeys.has(key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-3 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {hit.degree} {hit.specialtyName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {hit.collegeName} · {hit.state}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? "secondary" : "default"}
                    disabled={added}
                    className="shrink-0 gap-1.5"
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
      </section>
    </div>
  );
}
