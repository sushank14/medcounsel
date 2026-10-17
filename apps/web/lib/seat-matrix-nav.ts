export function seatMatrixHref(
  params: Record<string, string | undefined>,
  page?: number
): string {
  const q = new URLSearchParams();
  if (params.source) q.set("source", params.source);
  if (params.year) q.set("year", params.year);
  if (params.state) q.set("state", params.state);
  if (params.degree) q.set("degree", params.degree);
  if (params.quota) q.set("quota", params.quota);
  if (params.category) q.set("category", params.category);
  if (params.diffYear) q.set("diffYear", params.diffYear);
  if (params.q) q.set("q", params.q);
  if (page && page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/seat-matrix?${s}` : "/seat-matrix";
}
