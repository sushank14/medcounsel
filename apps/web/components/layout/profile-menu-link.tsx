import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileMenuLink({
  href,
  icon: Icon,
  label,
  description,
  badge,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  badge?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="truncate text-xs text-slate-500">{description}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}
