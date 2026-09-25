"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const PIPELINES = [
  { id: "mcc", label: "Import MCC cutoffs", desc: "AIQ allotment PDFs 2020–2025" },
  { id: "neetpg-colleges", label: "Import NEET-PG colleges", desc: "Seat matrix + all institutes" },
  { id: "maharashtra", label: "Import Maharashtra SML", desc: "State counselling 2025" },
  { id: "fees", label: "Apply fee/stipend estimates", desc: "NMC-scale defaults by college type" },
];

export function ImportTrigger() {
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (pipeline: string) => {
    setRunning(pipeline);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setMessage(`✓ ${pipeline} completed successfully`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold">Run import pipeline</h2>
      <p className="text-sm text-slate-500">Trigger official data imports from the admin panel (runs CLI importers).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PIPELINES.map((p) => (
          <div key={p.id} className="rounded-lg border p-4">
            <p className="font-medium">{p.label}</p>
            <p className="mb-3 text-xs text-slate-500">{p.desc}</p>
            <Button size="sm" disabled={!!running} onClick={() => run(p.id)}>
              {running === p.id ? "Running..." : "Run import"}
            </Button>
          </div>
        ))}
      </div>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
