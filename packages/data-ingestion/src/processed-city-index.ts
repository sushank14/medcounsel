/**
 * Build city/state hints from official processed cutoff JSON (MCC + Maharashtra).
 */
import fs from "fs";
import path from "path";
import { extractCityFromInstitute } from "./college-resolver.js";
import { extractStateFromInstitute, normalizeCollegeName } from "./normalizers.js";
import { displayCity, isGarbageCity } from "../../types/src/college-display.js";

export type LocationHint = { city: string; state: string };

const PROCESSED_MCC = path.resolve(process.cwd(), "../../data/processed/mcc");
const PROCESSED_MH = path.resolve(process.cwd(), "../../data/processed/maharashtra");

const VALID_STATES = new Set([
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Delhi (NCT)", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Jammu And Kashmir",
  "Jammu and Kashmir", "Chandigarh", "Puducherry",
]);

function normalizeState(raw: string): string | null {
  const s = raw.replace(/\d+.*/, "").replace(/-$/, "").trim();
  if (!s || s === "Unknown") return null;
  if (VALID_STATES.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower.includes("maharashtra")) return "Maharashtra";
  if (lower.includes("tamil nadu")) return "Tamil Nadu";
  if (lower.includes("uttar pradesh")) return "Uttar Pradesh";
  if (lower.includes("west bengal")) return "West Bengal";
  if (lower.includes("jammu")) return "Jammu And Kashmir";
  if (lower.includes("delhi")) return "Delhi (NCT)";
  if (lower.includes("telangana")) return "Telangana";
  if (lower.includes("karnataka")) return "Karnataka";
  if (lower.includes("kerala")) return "Kerala";
  if (lower.includes("gujarat")) return "Gujarat";
  if (lower.includes("rajasthan")) return "Rajasthan";
  if (lower.includes("punjab")) return "Punjab";
  if (lower.includes("haryana")) return "Haryana";
  if (lower.includes("bihar")) return "Bihar";
  if (lower.includes("odisha")) return "Odisha";
  if (lower.includes("assam")) return "Assam";
  if (lower.includes("madhya pradesh")) return "Madhya Pradesh";
  if (lower.includes("uttarakhand")) return "Uttarakhand";
  if (lower.includes("andhra")) return "Andhra Pradesh";
  if (lower.includes("chhattisgarh")) return "Chhattisgarh";
  if (lower.includes("himachal")) return "Himachal Pradesh";
  if (lower.includes("goa")) return "Goa";
  return null;
}

function addHint(
  index: Map<string, LocationHint>,
  key: string,
  city: string,
  state: string
) {
  if (!key || key.length < 4) return;
  const cleanCity = displayCity(city);
  const cleanState = normalizeState(state);
  if (!cleanCity || isGarbageCity(cleanCity) || !cleanState) return;
  if (!index.has(key)) index.set(key, { city: cleanCity, state: cleanState });
}

export function buildProcessedLocationIndex(): Map<string, LocationHint> {
  const index = new Map<string, LocationHint>();

  if (fs.existsSync(PROCESSED_MCC)) {
    for (const file of fs.readdirSync(PROCESSED_MCC).filter((f) => f.endsWith("-cutoffs.json"))) {
      const rows = JSON.parse(fs.readFileSync(path.join(PROCESSED_MCC, file), "utf8")) as Array<{
        institute: string;
      }>;
      for (const row of rows) {
        const city = extractCityFromInstitute(row.institute);
        const { state } = extractStateFromInstitute(row.institute);
        const key = normalizeCollegeName(row.institute);
        addHint(index, key, city, state);
        const head = row.institute.split(",")[0]?.trim() ?? "";
        if (head) addHint(index, normalizeCollegeName(head), city, state);
      }
    }
  }

  if (fs.existsSync(PROCESSED_MH)) {
    for (const file of fs.readdirSync(PROCESSED_MH).filter((f) => f.endsWith(".json"))) {
      const rows = JSON.parse(fs.readFileSync(path.join(PROCESSED_MH, file), "utf8")) as Array<{
        college: string;
        city?: string;
      }>;
      for (const row of rows) {
        const city = row.city ?? "";
        const key = normalizeCollegeName(row.college);
        addHint(index, key, city, "Maharashtra");
        const head = row.college.split(",")[0]?.trim() ?? row.college;
        addHint(index, normalizeCollegeName(head), city, "Maharashtra");
      }
    }
  }

  return index;
}
