"use client";

import { usePreferenceIds } from "@/components/mcc-finder/preference-store";

export function AddPreferenceButton({ id }: { id: string }) {
  const [ids, setIds] = usePreferenceIds();
  const saved = ids.includes(id);
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
      onClick={() => setIds(saved ? ids.filter((item) => item !== id) : [...ids, id])}
    >
      {saved ? "Saved" : "Add"}
    </button>
  );
}
