import { Code2 } from "lucide-react";
import { CREATOR } from "@/lib/creator";
import { LinkedInButton } from "@/components/about/linkedin-button";

export function CreatorCard({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={
        compact
          ? "card border-slate-200 bg-slate-50/80 p-4"
          : "card border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5"
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Code2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">MedCounsel</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Built with care by{" "}
            <span className="font-medium text-slate-900">{CREATOR.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{CREATOR.role}</p>
          {!compact && (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              A personal project created for {CREATOR.builtFor}&apos;s counselling journey — and
              everyone navigating NEET-PG.
            </p>
          )}
          <div className="mt-3">
            <LinkedInButton size="sm" />
          </div>
        </div>
      </div>
    </aside>
  );
}
