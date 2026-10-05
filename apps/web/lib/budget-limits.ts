/** Annual fee budget bands — shared by predictions and college search. Amounts in INR. */
export const BUDGET_LIMITS: Record<string, number> = {
  UNDER_5L: 500_000,
  RANGE_5_10L: 1_000_000,
  RANGE_10_20L: 2_000_000,
  RANGE_20_50L: 5_000_000,
  ABOVE_50L: Infinity,
  NO_RESTRICTION: Infinity,
};

export const BUDGET_RANGE_BANDS: Record<
  string,
  { label: string; min?: number; max?: number }
> = {
  UNDER_5L: { label: "Under ₹5L/yr", max: 500_000 },
  RANGE_5_10L: { label: "₹5–10L/yr", min: 500_001, max: 1_000_000 },
  RANGE_10_20L: { label: "₹10–20L/yr", min: 1_000_001, max: 2_000_000 },
  RANGE_20_50L: { label: "₹20–50L/yr", min: 2_000_001, max: 5_000_000 },
  ABOVE_50L: { label: "Above ₹50L/yr", min: 5_000_001 },
};

export const COLLEGE_BUDGET_FILTER_OPTIONS = [
  { value: "", label: "Any budget" },
  { value: "UNDER_5L", label: "Under ₹5L/yr" },
  { value: "RANGE_5_10L", label: "₹5–10L/yr" },
  { value: "RANGE_10_20L", label: "₹10–20L/yr" },
  { value: "RANGE_20_50L", label: "₹20–50L/yr" },
  { value: "ABOVE_50L", label: "Above ₹50L/yr" },
] as const;

export function feeMatchesBudget(totalAnnual: number, budgetKey: string): boolean {
  const band = BUDGET_RANGE_BANDS[budgetKey];
  if (!band) return true;
  if (band.min != null && totalAnnual < band.min) return false;
  if (band.max != null && totalAnnual > band.max) return false;
  return true;
}
