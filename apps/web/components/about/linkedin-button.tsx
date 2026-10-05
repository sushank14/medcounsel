import { Linkedin } from "lucide-react";
import { CREATOR } from "@/lib/creator";
import { cn } from "@/lib/utils";

export function LinkedInButton({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <a
      href={CREATOR.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        className
      )}
    >
      <Linkedin className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      View LinkedIn
    </a>
  );
}
