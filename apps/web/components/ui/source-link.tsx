import { ExternalLink } from "lucide-react";

export function SourceLink({
  url,
  title,
  verifiedAt,
  compact,
}: {
  url: string;
  title?: string;
  verifiedAt?: Date | string | null;
  compact?: boolean;
}) {
  const date =
    verifiedAt &&
    new Date(verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Official source
      </a>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900">
      <p className="font-medium">Data source</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 hover:underline">
        <ExternalLink className="h-3 w-3" />
        {title ?? "View official document"}
      </a>
      {date && <p className="mt-1 text-emerald-700">Verified {date}</p>}
    </div>
  );
}
