"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FitLevel } from "@medcounsel/types";
import { displayCollegeName, formatCollegeLocation, fitLevelToTier, CHOICE_TIER_LABELS } from "@medcounsel/types";
import { FitBadge } from "@/components/prediction/fit-badge";

export type ChoiceListRow = {
  id: string;
  sortOrder: number;
  college: { name: string; slug: string; city: string; state: string };
  specialty: { name: string; degree: string };
  fitSnapshot: string;
  optimizeNote?: string;
};

function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ChoiceListEditorProps {
  items: ChoiceListRow[];
  onReorder: (orderedIds: string[]) => Promise<void>;
  onRemove: (itemId: string) => void;
  reordering?: boolean;
}

export function ChoiceListEditor({ items, onReorder, onRemove, reordering }: ChoiceListEditorProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const getDropIndex = useCallback((clientY: number) => {
    if (!listRef.current) return 0;
    const rows = Array.from(listRef.current.querySelectorAll("[data-choice-item]")) as HTMLElement[];
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return Math.max(0, rows.length - 1);
  }, []);

  const commitReorder = useCallback(
    async (from: number, to: number) => {
      if (from === to) return;
      const reordered = reorderList(localItems, from, to);
      setLocalItems(reordered);
      await onReorder(reordered.map((i) => i.id));
    },
    [localItems, onReorder]
  );

  const moveTo = async (index: number, target: number) => {
    const to = Math.max(0, Math.min(localItems.length - 1, target));
    await commitReorder(index, to);
  };

  const onPointerDown = (index: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (reordering) return;
    e.preventDefault();
    dragIndexRef.current = index;
    setDraggingIndex(index);
    setOverIndex(index);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragIndexRef.current === null) return;
    setOverIndex(getDropIndex(e.clientY));
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragIndexRef.current === null) return;
    const from = dragIndexRef.current;
    const to = getDropIndex(e.clientY);
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
    await commitReorder(from, to);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div ref={listRef} className="space-y-3">
      {localItems.map((item, idx) => {
        const fit = JSON.parse(item.fitSnapshot || "{}") as { fitLevel?: string };
        const tier = fit.fitLevel ? fitLevelToTier(fit.fitLevel) : null;
        return (
          <div
            key={item.id}
            data-choice-item
            className={cn(
              "card flex flex-col gap-4 rounded-xl p-4 transition-all sm:flex-row sm:items-start md:p-5",
              draggingIndex === idx && "scale-[0.99] opacity-60 shadow-md",
              overIndex === idx && draggingIndex !== null && draggingIndex !== idx && "border-brand-400 bg-brand-50/50"
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button
                type="button"
                className="mt-0.5 cursor-grab touch-none rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed"
                aria-label="Drag to reorder"
                disabled={!!reordering}
                onPointerDown={(e) => onPointerDown(idx, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
              >
                <GripVertical className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold leading-snug text-slate-900">
                  {item.specialty.degree} {item.specialty.name}
                </p>
                <p className="text-sm text-slate-600">{displayCollegeName(item.college.name)}</p>
                <p className="text-xs text-slate-400">
                  {formatCollegeLocation(item.college.city, item.college.state, item.college.name, item.college.slug)}
                </p>
                {(fit.fitLevel || tier) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {fit.fitLevel && <FitBadge fitLevel={fit.fitLevel as FitLevel} />}
                    {tier && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {CHOICE_TIER_LABELS[tier].label}
                      </span>
                    )}
                  </div>
                )}
                {item.optimizeNote && (
                  <p className="mt-2 rounded-lg bg-brand-50/80 px-2.5 py-1.5 text-xs leading-relaxed text-brand-900/90">
                    {item.optimizeNote}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
              <div className="flex rounded-lg bg-slate-50 p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={!!reordering || idx === 0}
                  aria-label="Move to top"
                  onClick={() => moveTo(idx, 0)}
                >
                  <ChevronsUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={!!reordering || idx === 0}
                  aria-label="Move up"
                  onClick={() => moveTo(idx, idx - 1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={!!reordering || idx === localItems.length - 1}
                  aria-label="Move down"
                  onClick={() => moveTo(idx, idx + 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={!!reordering || idx === localItems.length - 1}
                  aria-label="Move to bottom"
                  onClick={() => moveTo(idx, localItems.length - 1)}
                >
                  <ChevronsDown className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-red-600"
                onClick={() => onRemove(item.id)}
                disabled={!!reordering}
                aria-label="Remove from list"
              >
                <X className="h-4 w-4" />
                <span className="ml-1 text-xs sm:sr-only">Remove</span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
