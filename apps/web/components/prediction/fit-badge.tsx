import { FIT_LABELS, type FitLevel } from "@medcounsel/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FitBadge({ fitLevel }: { fitLevel: FitLevel }) {
  const { label, color, emoji } = FIT_LABELS[fitLevel];
  return (
    <Badge className={cn("border", color)}>
      {emoji} {label}
    </Badge>
  );
}
