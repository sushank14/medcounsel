"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityListEditorProps {
  priorities: string[];
  onChange: (priorities: string[]) => void;
  className?: string;
}

function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function PriorityListEditor({ priorities, onChange, className }: PriorityListEditorProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const getDropIndex = useCallback((clientY: number) => {
    if (!listRef.current) return 0;
    const items = Array.from(
      listRef.current.querySelectorAll("[data-priority-item]")
    ) as HTMLElement[];

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    return Math.max(0, items.length - 1);
  }, []);

  const finishDrag = useCallback(
    (from: number, to: number) => {
      if (from !== to) onChange(reorderList(priorities, from, to));
      dragIndexRef.current = null;
      setDraggingIndex(null);
      setOverIndex(null);
    },
    [priorities, onChange]
  );

  const onPointerDown = (index: number, e: React.PointerEvent<HTMLButtonElement>) => {
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

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragIndexRef.current === null) return;
    finishDrag(dragIndexRef.current, getDropIndex(e.clientY));
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <ol ref={listRef} className={cn("space-y-2", className)}>
      {priorities.map((p, i) => (
        <li
          key={p}
          data-priority-item
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-all",
            draggingIndex === i && "scale-[0.98] opacity-60 shadow-md",
            overIndex === i &&
              draggingIndex !== null &&
              draggingIndex !== i &&
              "border-brand-500 bg-brand-50/40"
          )}
        >
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
            aria-label={`Drag to reorder ${p}`}
            onPointerDown={(e) => onPointerDown(i, e)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <GripVertical className="h-5 w-5" aria-hidden />
          </button>
          <span className="w-6 shrink-0 font-medium text-brand-600">{i + 1}</span>
          <span className="flex-1 select-none">{p}</span>
        </li>
      ))}
    </ol>
  );
}
