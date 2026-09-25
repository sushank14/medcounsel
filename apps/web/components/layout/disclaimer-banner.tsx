import { AlertTriangle } from "lucide-react";
import { DISCLAIMER } from "@medcounsel/types";

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className={compact ? "text-xs" : "text-sm"}>{DISCLAIMER}</p>
    </div>
  );
}
