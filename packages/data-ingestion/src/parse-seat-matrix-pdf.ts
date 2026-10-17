import fs from "fs";
import pdf from "pdf-parse";
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import { is2025SeatMatrixFormat, parse2025SeatMatrixText } from "./parse-seat-matrix-2025.js";
import {
  is2026ColumnSeatMatrixFormat,
  is2026DnbSeatMatrixFormat,
  parse2026ColumnMatrix,
  parse2026Dnb,
} from "./parse-seat-matrix-2026-columns.js";

export type SeatMatrixCategory = "AIQ" | "DEEMED" | "CENTRAL" | "DNB";

/** NEET reservation category seat counts (when parsed from MCC matrix PDFs). */
export type ReservationCategoryKey = "GENERAL" | "EWS" | "OBC" | "SC" | "ST" | "PWD";

export interface ParsedSeatMatrixRow {
  instituteCode: string;
  institute: string;
  instituteNorm: string;
  state: string;
  program: string;
  degree: string;
  specialty: string;
  specialtySlug: string;
  quota: string;
  totalSeats: number;
  category: SeatMatrixCategory;
  reservationSeats?: Partial<Record<ReservationCategoryKey, number>>;
}

const INSTITUTE_TAIL = /\((\d{5,7})\)\s*$/;
const QUOTAS =
  /(All India|Delhi University Quota|Delhi University|Banaras Hindu University|Banaras Hindu|Aligarh Muslim University|Aligarh Muslim|IP University Quota|IP University|Management\/Paid Seats Quota|Management\/Paid|Non-Resident Indian|Muslim Minority Quota|Jain Minority Quota|Armed Forces Medical|DNB Quota\s*(?:\(NBEMS(?:-DIPLOMA)?\))?)/i;

const PROGRAM_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|MD\/MS)/i;
const SKIP = /^(Page \d+|Institute|Program|Quota|Open|General|EWS|OBC|SC|ST|PwD|Total|Seats|Matrix|Counselling|State|Name|Branch|Category|Institute Type|Deemed University|Deemed Uni\.|All India Quota|FINAL DNB)/i;

const INDIAN_STATES = new Set([
  "Andaman And Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra And Nagar Haveli", "Daman And Diu", "Delhi", "Delhi (NCT)",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu And Kashmir", "Jammu & Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]);

function cleanInstituteName(raw: string) {
  return raw.replace(INSTITUTE_TAIL, "").replace(/\s+/g, " ").trim();
}

function extractTotalSeats(digits: string): number {
  if (!digits) return 0;
  const n = parseInt(digits.slice(-2), 10);
  return Number.isFinite(n) ? n : parseInt(digits.slice(-1), 10) || 0;
}

function pushRow(
  results: ParsedSeatMatrixRow[],
  partial: Omit<ParsedSeatMatrixRow, "degree" | "specialty" | "specialtySlug" | "instituteNorm">
) {
  const { degree, specialty, slug } = parseCourse(partial.program);
  results.push({
    ...partial,
    instituteNorm: normalizeCollegeName(partial.institute),
    degree,
    specialty,
    specialtySlug: slug,
  });
}

/** 2024 AIQ / Central — often one line: Name(code)ProgramQuotaDigits */
function parseAiqInline(lines: string[], category: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.test(line)) continue;

    const codeIdx = line.search(/\(\d{5,7}\)/);
    if (codeIdx < 0) continue;

    const beforeCode = line.slice(0, codeIdx);
    const afterMatch = line.slice(codeIdx).match(/^\((\d{5,7})\)(.*)$/);
    if (!afterMatch) continue;

    const instituteCode = afterMatch[1];
    let rest = afterMatch[2];
    let institute = beforeCode.trim();

    // Multiline program before quota
    if (!QUOTAS.test(rest)) {
      const programParts: string[] = [];
      while (i + 1 < lines.length && !QUOTAS.test(lines[i + 1]) && lines[i + 1].search(/\(\d{5,7}\)/) < 0) {
        if (SKIP.test(lines[i + 1])) {
          i++;
          continue;
        }
        programParts.push(lines[++i]);
      }
      if (i + 1 < lines.length && QUOTAS.test(lines[i + 1])) {
        rest = programParts.join(" ") + " " + lines[++i];
      } else {
        rest = programParts.join(" ");
      }
    }

    const quotaMatch = rest.match(new RegExp(`^(.+?)${QUOTAS.source}(\\d*)$`, "i"));
    if (!quotaMatch) continue;

    const program = quotaMatch[1].replace(/\s+/g, " ").trim();
    const quota = quotaMatch[2].trim();
    const totalSeats = extractTotalSeats(quotaMatch[3] ?? "");

    if (!program || !institute) continue;

    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program,
      quota,
      totalSeats,
      category,
    });
  }

  return results;
}

/** Deemed — lines start with "Deemed University" */
function parseDeemed(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];
    if (!line.startsWith("Deemed University")) {
      i++;
      continue;
    }

    line = line.replace(/^Deemed University\s*/, "");
    const codeIdx = line.search(/\(\d{5,7}\)/);
    if (codeIdx < 0) {
      i++;
      continue;
    }

    const institute = line.slice(0, codeIdx).trim();
    const tail = line.slice(codeIdx);
    const m = tail.match(/^\((\d{5,7})\)(.*)$/);
    if (!m) {
      i++;
      continue;
    }

    const instituteCode = m[1];
    let rest = m[2];

    if (!QUOTAS.test(rest)) {
      const programParts: string[] = [];
      while (i + 1 < lines.length && !lines[i + 1].startsWith("Deemed University") && !QUOTAS.test(lines[i + 1])) {
        if (SKIP.test(lines[i + 1])) {
          i++;
          continue;
        }
        programParts.push(lines[++i]);
      }
      if (i + 1 < lines.length && QUOTAS.test(lines[i + 1])) {
        rest = (programParts.length ? programParts.join(" ") + " " : "") + lines[++i];
      } else {
        rest = programParts.join(" ");
      }
    }

    const quotaMatch = rest.match(new RegExp(`^(.+?)${QUOTAS.source}(\\d*)$`, "i"));
    if (!quotaMatch) {
      i++;
      continue;
    }

    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program: quotaMatch[1].replace(/\s+/g, " ").trim(),
      quota: quotaMatch[2].trim(),
      totalSeats: parseInt(quotaMatch[3] || "0", 10) || 0,
      category: "DEEMED",
    });
    i++;
  }

  return results;
}

function resolveState(line: string, next?: string): string | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (INDIAN_STATES.has(normalized)) return normalized;
  if (next) {
    const combined = `${normalized} ${next}`.replace(/\s+/g, " ").trim();
    if (INDIAN_STATES.has(combined)) return combined;
  }
  return null;
}

/** DNB — State header + institute block + quota line */
function parseDnb(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let state = "Unknown";
  let buffer: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (SKIP.test(line)) {
      i++;
      continue;
    }

    const resolvedState = resolveState(line, lines[i + 1]);
    if (resolvedState) {
      state = resolvedState;
      if (resolvedState.includes(" ") && !INDIAN_STATES.has(line)) i++;
      buffer = [];
      i++;
      continue;
    }

    if (/^DNB Quota/i.test(line)) {
      i++;
      continue;
    }

    const codeMatch = line.match(/\((\d{5,7})\)\s*$/);
    if (!codeMatch) {
      buffer.push(line);
      i++;
      continue;
    }

    const instituteCode = codeMatch[1];
    const instituteParts = [...buffer, cleanInstituteName(line)];
    buffer = [];
    i++;

    if (i >= lines.length || !QUOTAS.test(lines[i])) continue;

    const quotaLine = lines[i];
    const qm = quotaLine.match(/^(DNB Quota\s*(?:\(NBEMS(?:-DIPLOMA)?\))?)\s*(.+?)\s*(OP|EW|BC|SC|ST|GN|AI)\s*(NO|PH)?\s*(\d+)\s*$/i);
    if (!qm) {
      // fallback: branch + trailing digit
      const fb = quotaLine.match(/^(DNB Quota[^A-Z]*)\s*(.+?)\s*(\d+)\s*$/i);
      if (!fb) continue;
      pushRow(results, {
        instituteCode,
        institute: instituteParts.join(" ").replace(/\s+/g, " ").trim(),
        state,
        program: fb[2].trim(),
        quota: fb[1].trim(),
        totalSeats: parseInt(fb[3], 10) || 0,
        category: "DNB",
      });
      i++;
      continue;
    }

    pushRow(results, {
      instituteCode,
      institute: instituteParts.join(" ").replace(/\s+/g, " ").trim(),
      state,
      program: qm[2].trim(),
      quota: qm[1].trim(),
      totalSeats: parseInt(qm[5], 10) || 0,
      category: "DNB",
    });
    i++;
  }

  return results;
}

/** 2023 AIQ — institute ends with (code), program on following lines, quota line separate */
function parseAiqLegacy(lines: string[], category: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let i = 0;

  while (i < lines.length) {
    if (SKIP.test(lines[i])) {
      i++;
      continue;
    }

    const instituteParts: string[] = [];
    while (i < lines.length) {
      instituteParts.push(lines[i]);
      if (INSTITUTE_TAIL.test(lines[i])) break;
      i++;
    }
    if (i >= lines.length || !INSTITUTE_TAIL.test(lines[i])) {
      i++;
      continue;
    }

    const codeMatch = lines[i].match(INSTITUTE_TAIL)!;
    const instituteCode = codeMatch[1];
    const institute = instituteParts.join(" ").replace(INSTITUTE_TAIL, "").replace(/\s+/g, " ").trim();
    i++;

    const programParts: string[] = [];
    while (i < lines.length && !QUOTAS.test(lines[i]) && !INSTITUTE_TAIL.test(lines[i])) {
      if (SKIP.test(lines[i])) {
        i++;
        continue;
      }
      programParts.push(lines[i++]);
    }
    if (i >= lines.length || !QUOTAS.test(lines[i])) continue;

    const qm = lines[i].match(new RegExp(`^${QUOTAS.source}(\\d*)$`, "i"));
    if (!qm) {
      i++;
      continue;
    }

    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program: programParts.join(" ").replace(/\s+/g, " ").trim(),
      quota: qm[1],
      totalSeats: extractTotalSeats(qm[2] ?? ""),
      category,
    });
    i++;
  }

  return results;
}

export function detectSeatMatrixFormat(text: string): "DNB" | "DEEMED" | "AIQ_INLINE" | "AIQ_LEGACY" {
  const compact = text.replace(/\s+/g, "");
  if (/StateNameInstituteQuotaBranch/i.test(compact)) return "DNB";
  if (/DeemedUniversity/i.test(compact) && /InstituteType/i.test(compact)) return "DEEMED";
  if (/InstituteProgramQuotaOpen/i.test(compact)) return "AIQ_INLINE";
  return "AIQ_LEGACY";
}

export function parseSeatMatrixText(text: string, category: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (category === "DNB" && is2026DnbSeatMatrixFormat(text)) {
    return parse2026Dnb(lines);
  }

  if (is2026ColumnSeatMatrixFormat(text)) {
    return parse2026ColumnMatrix(lines, category);
  }

  if (is2025SeatMatrixFormat(text)) {
    return parse2025SeatMatrixText(text, category);
  }

  const format = detectSeatMatrixFormat(text);
  if (format === "DNB") return parseDnb(lines);
  if (format === "DEEMED") return parseDeemed(lines);
  if (format === "AIQ_INLINE") return parseAiqInline(lines, category);
  return parseAiqLegacy(lines, category);
}

export async function parseSeatMatrixPdfFile(
  pdfPath: string,
  category: SeatMatrixCategory
): Promise<ParsedSeatMatrixRow[]> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  return parseSeatMatrixText(data.text, category);
}

export function uniqueInstitutes(rows: ParsedSeatMatrixRow[]) {
  const map = new Map<string, ParsedSeatMatrixRow>();
  for (const row of rows) {
    const key = row.instituteCode;
    const existing = map.get(key);
    if (!existing || row.state !== "Unknown") map.set(key, row);
  }
  return [...map.values()];
}
