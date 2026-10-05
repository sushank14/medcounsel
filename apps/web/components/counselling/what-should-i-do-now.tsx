import Link from "next/link";
import type { NextAction } from "@/lib/counselling-guidance";
import { Badge } from "@/components/ui/badge";

export function WhatShouldIDoNow({ actions }: { actions: NextAction[] }) {
  if (!actions.length) return null;

  return (
    <section className="card border-brand-200 bg-brand-50/40 p-5">
      <h2 className="text-lg font-semibold text-brand-900">What should I do now?</h2>
      <p className="mt-1 text-sm text-brand-800/80">Based on your profile, choice list, and the counselling calendar.</p>
      <ol className="mt-4 space-y-3">
        {actions.map((action, i) => (
          <li key={action.title} className="flex gap-3 rounded-lg bg-white/80 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{action.title}</p>
                {action.phase === "urgent" && (
                  <Badge className="bg-red-100 text-red-800">Active now</Badge>
                )}
                {action.source === "expected" && (
                  <Badge className="bg-amber-100 text-amber-800">Expected dates</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">{action.description}</p>
              {action.href && (
                <Link href={action.href} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
                  Go →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
