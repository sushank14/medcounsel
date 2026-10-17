/**
 * MCC NEET-PG 2026 AIQ / Central / Deemed — column layout:
 * State · Institute type · Institute · Quota · Branch · Category · Total seats
 * Example: All IndiaM.D. Anatomy (ANAT)BC NO1
 */
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import type { ParsedSeatMatrixRow, ReservationCategoryKey, SeatMatrixCategory } from "./parse-seat-matrix-pdf.js";
import { parseReservationDigits, reservationSeatsFromBreakdown } from "./parse-seat-matrix-2025.js";

const PROGRAM_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|MD\/MS)/i;

const QUOTA_ALT =
  "All India|Delhi University Quota|Delhi University|Banaras Hindu University|Banaras Hindu|Aligarh Muslim University|Aligarh Muslim|IP University Quota|IP University|Management\\/Paid Seats Quota|Management\\/Paid|Non-Resident Indian|Muslim Minority Quota|Jain Minority Quota|Self-Financed Merit Seat";

const QUOTAS = new RegExp(`(?:${QUOTA_ALT})`, "i");

const SKIP =
  /^(Page \d+|StateNameInstituteType|FINAL |State$|Name$|InstituteType$|Institute$|Quota$|Branch$|Category$|TotalSeats$|Total Seats$)/i;

const INSTITUTE_TYPE =
  /(All India except Central University|Central University|Deemed University)/i;

const CODE_IN_LINE = /\((\d{5,7})\)/;

const SEAT_TAIL = /(OP|EW|BC|SC|ST)\s+(NO|PH)(\d+)\s*$/i;

export function is2026ColumnSeatMatrixFormat(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  return /StateNameInstituteTypeInstituteQuotaBranchCategory/i.test(compact);
}

function reservationFrom(cat: string, pwdFlag: string): ReservationCategoryKey {
  if (pwdFlag.toUpperCase() === "PH") return "PWD";
  switch (cat.toUpperCase()) {
    case "OP":
      return "GENERAL";
    case "EW":
      return "EWS";
    case "BC":
      return "OBC";
    case "SC":
      return "SC";
    case "ST":
      return "ST";
    default:
      return "GENERAL";
  }
}

function parseQuotaProgramSeat(text: string): {
  quota: string;
  program: string;
  reservation: ReservationCategoryKey;
  seats: number;
} | null {
  const m = text.match(new RegExp(`^(${QUOTA_ALT})(.+?)${SEAT_TAIL.source}$`, "i"));
  if (!m) return null;
  const program = m[2].replace(/\s+/g, " ").trim();
  if (!PROGRAM_START.test(program)) return null;
  const seats = parseInt(m[5], 10);
  if (!Number.isFinite(seats) || seats <= 0) return null;
  return {
    quota: m[1].trim(),
    program,
    reservation: reservationFrom(m[3], m[4]),
    seats,
  };
}

function pushRow(
  results: ParsedSeatMatrixRow[],
  partial: Omit<ParsedSeatMatrixRow, "degree" | "specialty" | "specialtySlug" | "instituteNorm"> & {
    reservation: ReservationCategoryKey;
  }
) {
  const { degree, specialty, slug } = parseCourse(partial.program);
  if (!partial.institute || !partial.program || partial.totalSeats <= 0) return;
  results.push({
    instituteCode: partial.instituteCode,
    institute: partial.institute,
    state: partial.state,
    program: partial.program,
    quota: partial.quota,
    totalSeats: partial.totalSeats,
    category: partial.category,
    reservationSeats: { [partial.reservation]: partial.totalSeats },
    instituteNorm: normalizeCollegeName(partial.institute),
    degree,
    specialty,
    specialtySlug: slug,
  });
}

function resolveInstituteBefore(lines: string[], fromIdx: number, maxLookback = 12): {
  instituteCode: string;
  institute: string;
  state: string;
} | null {
  let instituteCode = "";
  let state = "Unknown";
  const nameParts: string[] = [];

  for (let k = fromIdx; k >= Math.max(0, fromIdx - maxLookback); k--) {
    const line = lines[k];

    const codeOnly = line.match(/^\((\d{5,7})\)$/);
    if (codeOnly) {
      instituteCode = codeOnly[1];
      continue;
    }

    const codeEmbedded = line.match(/^(.+?)\((\d{5,7})\)\s*$/);
    if (codeEmbedded) {
      instituteCode = codeEmbedded[2];
      nameParts.unshift(codeEmbedded[1].trim());
      break;
    }

    if (INSTITUTE_TYPE.test(line)) {
      const sm = line.match(/^(.+?)\s+(All India except Central University|Central University|Deemed University)\s*$/i);
      if (sm) state = sm[1].trim();
      break;
    }

    if (SKIP.test(line) || /^Page \d+/i.test(line)) continue;
    if (QUOTAS.test(line) && PROGRAM_START.test(line)) break;
    if (line.length > 2 && !PROGRAM_START.test(line)) nameParts.unshift(line);
  }

  if (!instituteCode) return null;
  const institute = nameParts.join(" ").replace(/\s+/g, " ").trim();
  if (!institute || institute.length < 3) return null;
  return { instituteCode, institute, state };
}

export function parse2026ColumnMatrix(lines: string[], matrixCategory: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.test(line)) continue;

    const embeddedCode = line.match(/^(.+?)\((\d{5,7})\)(.+)$/);
    if (embeddedCode) {
      const parsed = parseQuotaProgramSeat(embeddedCode[3]);
      if (parsed) {
        const institute = embeddedCode[1].replace(/\s+/g, " ").trim();
        const ctx = resolveInstituteBefore(lines, i - 1);
        pushRow(results, {
          instituteCode: embeddedCode[2],
          institute: institute.length >= 3 ? institute : ctx?.institute ?? institute,
          state: ctx?.state ?? "Unknown",
          program: parsed.program,
          quota: parsed.quota,
          totalSeats: parsed.seats,
          category: matrixCategory,
          reservation: parsed.reservation,
        });
        continue;
      }
    }

    const parsed = parseQuotaProgramSeat(line);
    if (!parsed) continue;

    const ctx = resolveInstituteBefore(lines, i - 1);
    if (!ctx) continue;

    pushRow(results, {
      ...ctx,
      program: parsed.program,
      quota: parsed.quota,
      totalSeats: parsed.seats,
      category: matrixCategory,
      reservation: parsed.reservation,
    });
  }

  return results;
}

/** 2026 DNB PDF — InstituteProgramQuotaOpen header + DNB Quota + 10-digit reservation string. */
export function is2026DnbSeatMatrixFormat(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  return /InstituteTypeInstituteProgramQuotaOpen/i.test(compact) && /DNBQuota/i.test(compact);
}

export function parse2026Dnb(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let state = "Unknown";
  let instituteCode = "";
  let institute = "";
  const pendingName: string[] = [];

  const flushInstitute = (line: string) => {
    const cm = line.match(/^(.+?)\((\d{5,7})\)\s*$/);
    if (!cm) return false;
    instituteCode = cm[2];
    const tail = cm[1].trim();
    institute = [...pendingName, tail].join(" ").replace(/\s+/g, " ").trim();
    pendingName.length = 0;
    return true;
  };

  for (const line of lines) {
    if (SKIP.test(line) || /^Institute Type/i.test(line) || /^Open$/i.test(line)) continue;
    if (/^PwD$|^General-|^EWS|^OBC|^SC|^ST|^Total Seats$/i.test(line)) continue;
    if (/^Diplomate of$|^National Board$|^\(DNB\)/i.test(line)) continue;

    if (/^Uttar Pradesh|^Maharashtra|^Delhi|^Karnataka/i.test(line) && line.length < 40) {
      state = line.trim();
    }

    const dnbLine = line.match(/^(?:\((?:NBEMS(?:-DIPLOMA)?)\)\s*)?(.+?)DNB Quota(\d[\d\s]*|\d+)\s*$/i);
    if (dnbLine) {
      const program = dnbLine[1].replace(/\s+/g, " ").trim();
      const breakdown = parseReservationDigits(dnbLine[2].replace(/\s/g, ""));
      if (!breakdown || breakdown.total <= 0 || !instituteCode || !institute) continue;

      const courseInput = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA)/i.test(program) ? program : `DNB ${program}`;
      const { degree, specialty, slug } = parseCourse(courseInput);

      results.push({
        instituteCode,
        institute,
        instituteNorm: normalizeCollegeName(institute),
        state,
        program: courseInput,
        degree: "DNB",
        specialty: specialty || program,
        specialtySlug: slug || "dnb",
        quota: "DNB Quota",
        totalSeats: breakdown.total,
        category: "DNB",
        reservationSeats: reservationSeatsFromBreakdown(breakdown),
      });
      continue;
    }

    if (flushInstitute(line)) continue;

    if (line.length > 2 && !/DNB Quota/i.test(line)) pendingName.push(line);
    if (pendingName.length > 12) pendingName.shift();
  }

  return results;
}
