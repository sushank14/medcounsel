"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GitCompare } from "lucide-react";

const STORAGE_KEY = "medcounsel-compare-v1";
const MAX = 3;

export function AddToCompareButton({
  collegeId,
  specialtyId,
  compact = false,
}: {
  collegeId: string;
  specialtyId: string;
  compact?: boolean;
}) {
  const router = useRouter();

  const add = () => {
    let items: Array<{ collegeId: string; specialtyId: string }> = [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) items = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!items.some((i) => i.collegeId === collegeId && i.specialtyId === specialtyId)) {
      items = [...items, { collegeId, specialtyId }].slice(-MAX);
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    router.push("/compare");
  };

  return (
    <Button type="button" variant="ghost" size={compact ? "sm" : "default"} onClick={add} className="gap-1">
      <GitCompare className="h-3.5 w-3.5" />
      {compact ? "Compare" : "Add to compare"}
    </Button>
  );
}
