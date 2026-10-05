/** Build /colleges search URL with filters + page */
export function collegesSearchHref(
  params: Record<string, string | undefined>,
  page = 1
): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.state) qs.set("state", params.state);
  if (params.type) qs.set("type", params.type);
  if (params.degree) qs.set("degree", params.degree);
  if (params.budget) qs.set("budget", params.budget);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/colleges?${s}` : "/colleges";
}

