/** Map MCC / Google Sheet StateName column → canonical state/UT label (matches app filters). */
const SHEET_STATE_ALIASES: Record<string, string> = {
  "andaman and nicobar islands": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  chandigarh: "Chandigarh",
  "jammu and kashmir": "Jammu and Kashmir",
  puducherry: "Puducherry",
  pondicherry: "Puducherry",
  "the dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  "nct of delhi": "Delhi",
  delhi: "Delhi",
};

const CANONICAL_STATES = new Set([
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Jammu and Kashmir",
  "Puducherry",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Ladakh",
]);

/** Exact strings from MCC 2026 AIQ Google Sheet (title-case quirks). */
const SHEET_EXACT: Record<string, string> = {
  "Andaman And Nicobar Islands": "Andaman and Nicobar Islands",
  "Jammu And Kashmir": "Jammu and Kashmir",
  "The Dadra And Nagar Haveli And Daman And Diu": "Dadra and Nagar Haveli and Daman and Diu",
};

export function normalizeMccSheetState(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Unknown";
  if (SHEET_EXACT[trimmed]) return SHEET_EXACT[trimmed];
  if (CANONICAL_STATES.has(trimmed)) return trimmed;
  const alias = SHEET_STATE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

export function isCanonicalIndianState(state: string): boolean {
  return CANONICAL_STATES.has(state);
}

/** States corrupted by legacy PDF parsing — must be replaced from sheet StateName. */
export function isGarbageCollegeState(state: string): boolean {
  if (!state || state === "Unknown") return true;
  if (state.length > 35) return true;
  if (/all india|except|management|quota|\(\d{5,7}\)|\d{5,6}/i.test(state)) return true;
  if (!isCanonicalIndianState(state) && !CANONICAL_STATES.has(normalizeMccSheetState(state))) {
    return true;
  }
  return false;
}

export function resolveCollegeStateFromMatrix(
  matrixState: string,
  existing: string | undefined,
  fromSeatMatrix: boolean
): string {
  const canon = normalizeMccSheetState(matrixState);
  if (fromSeatMatrix && canon !== "Unknown" && isCanonicalIndianState(canon)) {
    return canon;
  }
  if (existing && !isGarbageCollegeState(existing)) return existing;
  return canon !== "Unknown" ? canon : existing ?? "Unknown";
}
