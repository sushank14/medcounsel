/**
 * MCC NEET-PG 2025 seat matrix PDF parser.
 * 2025 PDFs use concatenated single-digit category columns + total seats.
 */
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import type { ParsedSeatMatrixRow, SeatMatrixCategory } from "./parse-seat-matrix-pdf.js";

const PROGRAM_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|MD\/MS)/i;
const CODE_RE = /\((\d{5,7})\)/;
const SKIP = /^(Page \d+|Institute Type|Institute$|Program$|Quota$|Open$|General$|General-$|EWS$|OBC$|SC$|ST$|PwD|TotalSeats|Total$|Seats$|Matrix$|Counselling$|State$|Name$|Branch$|Category$|All India Quota$|FINAL$|UPDATED$|TENTATIVE$)/i;

const QUOTAS =
  /(All India|Delhi University Quota|Delhi University|Banaras Hindu University|Banaras Hindu|Aligarh Muslim University|Aligarh Muslim|IP University Quota|IP University|Management\/Paid Seats Quota|Management\/Paid|Non-Resident Indian|Muslim Minority Quota|Jain Minority Quota|Armed Forces Medical|DNB Quota\s*(?:\(NBEMS(?:-DIPLOMA)?\))?)/i;

export function is2025SeatMatrixFormat(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (!/InstituteProgramQuotaOpen/i.test(compact)) return false;
  return (
    /AllIndia\d{8,}/i.test(compact) ||
    /Management\/PaidSeatsQuota\d{8,}/i.test(compact) ||
    /Non-ResidentIndian\d{8,}/i.test(compact) ||
    /DeemedUniversity.{0,80}\(\d{5,7}\)/i.test(compact)
  );
}

interface CategoryBreakdown {
  GENERAL: number;
  EWS: number;
  OBC: number;
  SC: number;
  ST: number;
  PWD: number;
  total: number;
}

/** Ten single-digit reservation columns + 1–2 digit total. */
export function parseReservationDigits(raw: string): CategoryBreakdown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const spaced = trimmed.match(/^([\d\s]+?)\s+(\d{1,3})$/);
  if (spaced) {
    const digits = spaced[1].replace(/\s/g, "");
    if (digits.length >= 10) {
      return breakdownFromDigits(digits.slice(0, 10), parseInt(spaced[2], 10));
    }
  }

  const compact = trimmed.replace(/\s/g, "");
  const m = compact.match(/^(\d{10})(\d{1,2})$/);
  if (m) return breakdownFromDigits(m[1], parseInt(m[2], 10));

  const m2 = compact.match(/^(\d{10})(\d)$/);
  if (m2) return breakdownFromDigits(m2[1], parseInt(m2[2], 10));

  return null;
}

function breakdownFromDigits(ten: string, total: number): CategoryBreakdown {
  const d = ten.split("").map((x) => parseInt(x, 10) || 0);
  return {
    GENERAL: d[0] + d[1],
    EWS: d[2] + d[3],
    OBC: d[4] + d[5],
    SC: d[6] + d[7],
    ST: d[8] + d[9],
    PWD: d[1] + d[3] + d[5] + d[7] + d[9],
    total,
  };
}

function pushRow(
  results: ParsedSeatMatrixRow[],
  partial: Omit<ParsedSeatMatrixRow, "degree" | "specialty" | "specialtySlug" | "instituteNorm">
) {
  const { degree, specialty, slug } = parseCourse(partial.program);
  if (!partial.institute || !partial.program || partial.totalSeats <= 0) return;
  results.push({
    ...partial,
    instituteNorm: normalizeCollegeName(partial.institute),
    degree,
    specialty,
    specialtySlug: slug,
  });
}

function extractInstituteName(lines: string[], codeLineIdx: number): string {
  const parts: string[] = [];
  for (let j = codeLineIdx - 1; j >= 0; j--) {
    const line = lines[j];
    if (SKIP.test(line)) break;
    if (PROGRAM_START.test(line)) break;
    if (CODE_RE.test(line) && j !== codeLineIdx) break;
    parts.unshift(line.trim());
  }

  const candidates = parts.filter(
    (l) =>
      l.length > 8 &&
      /Medical College|Hospital|Institute|Instt|College of|Nursing Home|Cancer|All India/i.test(l)
  );
  if (candidates.length) {
    return candidates[0].replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
  }

  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  const codeMatch = joined.match(/^(.+?)\s*\(\d{5,7}\)/);
  return (codeMatch?.[1] ?? joined).replace(/,\s*$/, "").trim();
}

export function parseProgramQuotaLine(
  line: string
): { program: string; quota: string; breakdown: CategoryBreakdown } | null {
  const quotaRe = new RegExp(QUOTAS.source, "i");
  const qm = line.match(quotaRe);
  if (!qm || qm.index == null) return null;

  const program = line.slice(0, qm.index).replace(/\s+/g, " ").trim();
  const quota = qm[0].trim();
  const tail = line.slice(qm.index + qm[0].length).trim();

  if (!PROGRAM_START.test(program)) return null;

  const breakdown = parseReservationDigits(tail);
  if (!breakdown || breakdown.total <= 0) return null;

  return { program, quota, breakdown };
}

/** AIQ / Central 2025 — multiline institute blocks with (code) headers. */
export function parse2025AiqCentral(lines: string[], category: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let instituteCode = "";
  let institute = "";
  let programParts: string[] = [];

  function flushQuotaLine(line: string) {
    const merged = [...programParts, line].join(" ").replace(/\s+/g, " ").trim();
    programParts = [];
    const parsed = parseProgramQuotaLine(merged);
    if (!parsed || !instituteCode || !institute) return;
    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program: parsed.program,
      quota: parsed.quota,
      totalSeats: parsed.breakdown.total,
      category,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.test(line)) continue;

    const codeOnly = line.match(/^\((\d{5,7})\)$/);
    if (codeOnly) {
      instituteCode = codeOnly[1];
      institute = extractInstituteName(lines, i);
      programParts = [];
      continue;
    }

    if (QUOTAS.test(line)) {
      flushQuotaLine(line);
      continue;
    }

    if (instituteCode && (PROGRAM_START.test(line) || programParts.length > 0)) {
      if (!CODE_RE.test(line)) programParts.push(line);
    }
  }

  return results;
}

/** Deemed 2025 — inline or multiline "Deemed University Name(code)Program Quota digits". */
export function parse2025Deemed(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let instituteCode = "";
  let institute = "";
  let programParts: string[] = [];

  function flushQuotaLine(line: string) {
    const merged = [...programParts, line].join(" ").replace(/\s+/g, " ").trim();
    programParts = [];
    const parsed = parseProgramQuotaLine(merged);
    if (!parsed || !instituteCode) return;
    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program: parsed.program,
      quota: parsed.quota,
      totalSeats: parsed.breakdown.total,
      category: "DEEMED",
    });
  }

  for (const line of lines) {
    if (SKIP.test(line)) continue;

    const head = line.match(/^Deemed University\s+(.+?)\((\d{5,7})\)(.*)$/i);
    if (head) {
      instituteCode = head[2];
      institute = head[1].trim();
      const rest = head[3].trim();
      if (QUOTAS.test(rest)) flushQuotaLine(rest);
      else if (rest) programParts = [rest];
      else programParts = [];
      continue;
    }

    if (QUOTAS.test(line)) {
      flushQuotaLine(line);
      continue;
    }

    if (instituteCode && (PROGRAM_START.test(line) || programParts.length > 0)) {
      programParts.push(line);
    }
  }

  return results;
}

/** DNB 2025 — "Name(NBEMS) Program DNB Quota digits" often on one line. */
export function parse2025Dnb(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];

  for (const line of lines) {
    if (SKIP.test(line)) continue;

    const codeIdx = line.search(/\(\d{5,7}\)/);
    if (codeIdx < 0) continue;

    const beforeCode = line.slice(0, codeIdx).trim();
    const afterCode = line.slice(codeIdx);
    const codeMatch = afterCode.match(/^\((\d{5,7})\)(.*)$/);
    if (!codeMatch) continue;

    const instituteCode = codeMatch[1];
    let rest = codeMatch[2];

    const quotaMatch = rest.match(new RegExp(`^(.+?)(${QUOTAS.source})\\s*(.*)$`, "i"));
    if (!quotaMatch) continue;

    const program = quotaMatch[1].replace(/\s+/g, " ").trim();
    const quota = quotaMatch[2].trim();
    const breakdown = parseReservationDigits(quotaMatch[3]);
    if (!breakdown || breakdown.total <= 0) continue;

    const institute = beforeCode
      .replace(/,\s*[A-Za-z].*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!institute || institute.length < 3) continue;

    pushRow(results, {
      instituteCode,
      institute,
      state: "Unknown",
      program,
      quota,
      totalSeats: breakdown.total,
      category: "DNB",
    });
  }

  return results;
}

export function parse2025SeatMatrixText(text: string, category: SeatMatrixCategory): ParsedSeatMatrixRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (category === "DEEMED") return parse2025Deemed(lines);
  if (category === "DNB") return parse2025Dnb(lines);
  return parse2025AiqCentral(lines, category);
}
