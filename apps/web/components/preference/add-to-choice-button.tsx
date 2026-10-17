"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import type { PredictionResult } from "@medcounsel/types";
import { syncChoiceListBackupFromServer } from "@/lib/preference-list-backup";

export function AddToChoiceButton({
  collegeId,
  specialtyId,
  fitSnapshot,
  compact = false,
}: {
  collegeId: string;
  specialtyId: string;
  fitSnapshot?: Partial<PredictionResult> | Record<string, unknown>;
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/preferences/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId,
          specialtyId,
          fitSnapshot: fitSnapshot ?? {},
        }),
      });
      if (res.status === 401) {
        setError("sign-in");
        return;
      }
      if (res.status === 409) {
        setAdded(true);
        void syncChoiceListBackupFromServer();
        return;
      }
      if (!res.ok) throw new Error("Failed to add");
      setAdded(true);
      void syncChoiceListBackupFromServer();
    } catch {
      setError("Could not save — try again or open My choice list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <Button
        type="button"
        variant={added ? "secondary" : "outline"}
        size={compact ? "sm" : "default"}
        disabled={loading || added}
        onClick={add}
        className="gap-1"
      >
        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {added ? "In list" : compact ? "Add" : "Add to choice list"}
      </Button>
      {error === "sign-in" && (
        <Link href="/login" className="text-xs font-medium text-brand-600 hover:underline">
          Sign in to save your list
        </Link>
      )}
      {error && error !== "sign-in" && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
