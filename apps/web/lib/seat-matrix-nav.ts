export function parseCourseSlugs(raw?: string | string[]): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return [
    ...new Set(
      parts
        .flatMap((p) => p.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export function seatMatrixHref(
  params: Record<string, string | string[] | undefined>,
  page?: number
): string {
  const q = new URLSearchParams();
  if (params.source && params.source !== "nmc") q.set("source", String(params.source));
  if (params.year) q.set("year", String(params.year));
  if (params.state) q.set("state", String(params.state));
  if (params.degree) q.set("degree", String(params.degree));
  for (const slug of parseCourseSlugs(params.course)) {
    q.append("course", slug);
  }
  if (params.quota) q.set("quota", String(params.quota));
  if (params.category) q.set("category", String(params.category));
  if (params.diffYear) q.set("diffYear", String(params.diffYear));
  if (params.q) q.set("q", String(params.q));
  if (page && page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/seat-matrix?${s}` : "/seat-matrix";
}
