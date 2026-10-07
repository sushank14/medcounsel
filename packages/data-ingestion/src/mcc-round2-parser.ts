/**
 * Parser for MCC Round 2 / Round 3 side-by-side allotment PDFs (2024–2025).
 * Each row: [Rank] → Round 1 block → Round 2 block → (optional Round 3 block).
 */
import { mapMccCategory, mapMccQuota, parseCourse } from "./normalizers.js";
import type { ParsedAllotment } from "./parse-mcc-pdf.js";
const QUOTA_EXPAND: Record<string, string> = {
  AIQ: "All India",
  AI: "All India",
  AM: "Aligarh Muslim University",
  BH: "Banaras Hindu University",
  DU: "Delhi University Quota",
  AD: "DNB Quota",
  IP: "IP University Quota",
  JM: "Jain Minority Quota",
  MM: "Muslim Minority Quota",
  NR: "Non-Resident Indian",
  PS: "Self-Financed Merit Seat",
  MNG: "Management/Paid Seats Quota",
  NRI: "Non-Resident Indian",
  AF: "Armed Forces Medical",
};

const COURSE_ABBR: Record<string, string> = {
  GMED: "M.D. (GENERAL MEDICINE)",
  GSUR: "M.S. (GENERAL SURGERY)",
  OPTH: "M.S. (OPHTHALMOLOGY)",
  OPHT: "M.S. (OPHTHALMOLOGY)",
  RADD: "M.D. (RADIO-DIAGNOSIS)",
  "DV-L": "M.D. (DERM.,VENE. and LEPROSY)/(DERMATOLOGY)",
  ASTH: "M.D. (ANAESTHESIOLOGY)",
  DOPH: "(NBEMS) OPHTHALMOLOGY",
  PAED: "M.D. (PAEDIATRICS)",
  OBGY: "M.D. (Obst. and Gynae)/MS (Obstetrics and Gynaecology)",
  PATH: "M.D. (PATHOLOGY)",
  ANAE: "M.D. (ANAESTHESIOLOGY)",
  ORTH: "M.S. (ORTHOPAEDICS)",
};

function expandQuota(raw: string): string {
  return QUOTA_EXPAND[raw.trim().toUpperCase()] ?? raw;
}

function expandCourse(raw: string): string {
  const key = raw.replace(/\s+/g, "").toUpperCase();
  return COURSE_ABBR[key] ?? raw;
}

const QUOTA_LINE =
  /^(All India|Delhi University|Banaras Hindu|Aligarh Muslim|IP University|Management\/Paid|Muslim Minority|Jain Minority|Non-Resident|DNB Quota|Armed Forces|Self-Financed|AIQ|AI|AD|DU|BH|AM|IP|JM|MM|NR|PS|AF)$/i;

const COURSE_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|\(NBEMS\)|\(NBEMS-DIPLOMA\))/i;
const COURSE_ABBR_ONLY = /^[A-Z]{2,6}$/;
const CAT_LINE = /^(Open|General-EWS|EWS|Other Backward|Schedule Caste|Schedule Tribe|Open Seat|General|OBC|BC|EW|GN|SC|ST)$/i;
const STATUS_START = /^(Reported|Not|Seat|Did)$/i;
const SKIP_LINE =
  /^(Page No\.|NEET-PG|Counselling Seats|Round 1|Round 2|Round 3|Rank|Allotted|Quota|Course|Remarks|candidate|Category|option No\.|Abbrevation|Description|Note\*|SNo|Fresh Allotted|in \d)/i;

function isRankLine(line: string, next?: string): boolean {
  if (/^\d{1,6}(AI|AD)[A-Za-z]/i.test(line)) return true;
  if (!/^\d{1,6}$/.test(line)) return false;
  const n = parseInt(line, 10);
  if (n < 1 || n > 500000) return false;
  if (!next) return false;
  if (next === "-") return true;
  if (QUOTA_LINE.test(next)) return true;
  if (/^(AI|AD)$/i.test(next)) return true;
  if (/^All India|^Delhi University|^DNB Quota/i.test(next)) return true;
  return false;
}

function splitMergedTokens(line: string): string[] {
  let s = line;
  s = s.replace(/^(\d{1,6})(AI|AD)([A-Za-z].*)$/i, "$1\n$2\n$3");
  s = s.replace(/^AI([A-Za-z])/i, "All India\n$1");
  s = s.replace(/(OPTH|OPHT|GMED|GSUR|RADD|ASTH|DOPH|PATH|ORTH|PAED|OBGY|ANAE|DV-L)(Reported|Not|Seat)/gi, "$1\n$2");
  s = s.replace(/(\))(OBC|EWS|Open|General|SC|ST)/g, "$1\n$2");
  s = s.replace(/(OBCOBC|EWSOpen|OpenGeneral|OpenOBC|OpenSC|OpenST)/g, (m) =>
    m.replace(/(OBC|EWS|General|Open|SC|ST)/g, "\n$1")
  );
  s = s.replace(/(Fresh Allotted)(\s*in\s*[23])/gi, "$1\n$2");
  s = s.replace(/-{2,}/g, "\n");
  return s.split("\n").map((p) => p.trim()).filter(Boolean);
}

function normalizeSideBySideLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const part of splitMergedTokens(line)) {
      if (/^Page No\./i.test(part)) continue;
      out.push(part);
    }
  }
  return out;
}

function readQuota(lines: string[], i: number): { quota: string; next: number } {
  let quota = lines[i];
  let j = i + 1;
  if (/^Delhi University$/i.test(quota) && lines[j] === "Quota") j++;
  if (/^Banaras Hindu$/i.test(quota) && lines[j] === "University") {
    quota += " University";
    j++;
  }
  if (/^Aligarh Muslim$/i.test(quota) && lines[j] === "University") {
    quota += " University";
    j++;
  }
  if (/^IP University$/i.test(quota) && lines[j] === "Quota") j++;
  if (/^Self-Financed$/i.test(quota) && lines[j] === "Merit Seat") {
    quota += " Merit Seat";
    j++;
  }
  if (/^Management\/Paid$/i.test(quota) && lines[j] === "Seats Quota") {
    quota += " Seats Quota";
    j++;
  }
  return { quota: expandQuota(quota), next: j };
}

function readUntilCourse(lines: string[], i: number): { parts: string[]; next: number } {
  const parts: string[] = [];
  let j = i;
  while (j < lines.length) {
    const line = lines[j];
    if (COURSE_START.test(line) || COURSE_ABBR_ONLY.test(line)) break;
    if (isRankLine(line, lines[j + 1])) break;
    if (QUOTA_LINE.test(line)) break;
    if (STATUS_START.test(line)) break;
    if (line === "-") break;
    parts.push(line);
    j++;
  }
  return { parts, next: j };
}

function readCourse(lines: string[], i: number): { course: string; next: number } {
  const parts: string[] = [];
  let j = i;
  if (COURSE_ABBR_ONLY.test(lines[j]) && !COURSE_START.test(lines[j])) {
    return { course: expandCourse(lines[j]), next: j + 1 };
  }
  while (j < lines.length) {
    const line = lines[j];
    if (CAT_LINE.test(line)) break;
    if (STATUS_START.test(line)) break;
    if (isRankLine(line, lines[j + 1])) break;
    if (QUOTA_LINE.test(line)) break;
    if (line === "-") break;
    parts.push(line);
    j++;
  }
  return { course: parts.join(" ").replace(/\s+/g, " ").trim(), next: j };
}

function readStatus(lines: string[], i: number): { next: number } {
  let j = i;
  if (lines[j] === "Not" && lines[j + 1] === "Reported") return { next: j + 2 };
  if (lines[j] === "Seat" && lines[j + 1] === "Surrendered") return { next: j + 2 };
  if (lines[j] === "Did") {
    while (j < lines.length && !STATUS_START.test(lines[j + 1] ?? "") && !isRankLine(lines[j + 1] ?? "", lines[j + 2])) {
      if (/fresh choices|Upgradation|Upgraded/i.test(lines[j])) break;
      j++;
    }
    return { next: j };
  }
  if (lines[j] === "Reported") return { next: j + 1 };
  return { next: j };
}

function readCategories(lines: string[], i: number): { allotted: string; candidate: string; next: number } {
  const allotted = lines[i] ?? "Open";
  let j = i + 1;
  let candidate = lines[j] ?? allotted;
  if (CAT_LINE.test(candidate) || /^(General|OBC|EWS|SC|ST|PwD)$/i.test(candidate)) {
    j++;
  } else {
    candidate = allotted;
  }
  return { allotted, candidate, next: j };
}

function skipDashes(lines: string[], i: number): number {
  let j = i;
  while (j < lines.length && lines[j] === "-") j++;
  return j;
}

function pushResult(results: ParsedAllotment[], row: Omit<ParsedAllotment, "instituteNorm" | "specialtySlug">) {
  const { degree, specialty, slug } = parseCourse(row.course);
  results.push({
    ...row,
    degree,
    specialty,
    specialtySlug: slug,
    instituteNorm: row.institute.toLowerCase().replace(/\s+/g, " "),
  });
}

function parseRoundBlock(
  lines: string[],
  i: number,
  rank: number
): { allotment: ParsedAllotment | null; next: number } {
  let j = skipDashes(lines, i);
  if (j >= lines.length || (!QUOTA_LINE.test(lines[j]) && !/^All India/i.test(lines[j]))) {
    return { allotment: null, next: j };
  }

  const { quota, next: qNext } = readQuota(lines, j);
  j = qNext;

  const { parts: instParts, next: instNext } = readUntilCourse(lines, j);
  j = instNext;
  if (!instParts.length) return { allotment: null, next: j };

  const { course, next: courseNext } = readCourse(lines, j);
  j = courseNext;
  if (!course) return { allotment: null, next: j };

  let allotted = "Open";
  let candidate = "General";
  if (CAT_LINE.test(lines[j] ?? "") || /^(OBC|EWS|SC|ST|General|Open|BC|EW|GN)$/i.test(lines[j] ?? "")) {
    const cats = readCategories(lines, j);
    allotted = cats.allotted;
    candidate = cats.candidate;
    j = cats.next;
  }

  if (/^\d+$/.test(lines[j] ?? "")) j++;

  while (j < lines.length) {
    const line = lines[j];
    if (isRankLine(line, lines[j + 1])) break;
    if (QUOTA_LINE.test(line)) break;
    if (/^Page No\./i.test(line)) break;
    if (/^(Upgraded?|No|Did|fresh|in \d|Round|Reported|Not|Seat)$/i.test(line)) {
      j++;
      continue;
    }
    if (line === "-") {
      j++;
      continue;
    }
    break;
  }

  const institute = instParts.join(" ").replace(/\s+/g, " ").trim();
  if (institute.length < 4) return { allotment: null, next: j };

  return {
    allotment: {
      rank,
      quota: mapMccQuota(quota),
      institute,
      course,
      category: mapMccCategory(allotted, candidate),
      candidateCategory: candidate,
    },
    next: j,
  };
}

export function parseRoundSideBySide(lines: string[], targetRound: "2" | "3"): ParsedAllotment[] {
  const normalized = normalizeSideBySideLines(lines);
  const results: ParsedAllotment[] = [];
  let i = 0;

  while (i < normalized.length) {
    const line = normalized[i];
    if (SKIP_LINE.test(line) || /^Page No\./i.test(line) || /^\d{1,2}-\d{2}-\d{4}/.test(line)) {
      i++;
      continue;
    }

    if (!isRankLine(line, normalized[i + 1])) {
      i++;
      continue;
    }

    const rank = parseInt(line, 10);
    i++;

    if (targetRound === "2") {
      // Round 1 — skip (proven path for R2 PDFs)
      if (QUOTA_LINE.test(normalized[i] ?? "")) {
        const { next: qNext } = readQuota(normalized, i);
        i = qNext;
        const { next: instNext } = readUntilCourse(normalized, i);
        i = instNext;
        const { next: courseNext } = readCourse(normalized, i);
        i = courseNext;
        i = readStatus(normalized, i).next;
      }

      const r2 = parseRoundBlock(normalized, i, rank);
      i = r2.next;
      if (r2.allotment?.institute && r2.allotment.course) {
        pushResult(results, r2.allotment);
      }
      i = skipDashes(normalized, i);
    } else {
      // R3 PDF: skip R1, skip R2 block, parse R3 column
      if (QUOTA_LINE.test(normalized[i] ?? "")) {
        const { next: qNext } = readQuota(normalized, i);
        i = qNext;
        const { next: instNext } = readUntilCourse(normalized, i);
        i = instNext;
        const { next: courseNext } = readCourse(normalized, i);
        i = courseNext;
        i = readStatus(normalized, i).next;
      }

      const r2 = parseRoundBlock(normalized, i, rank);
      i = r2.next;
      i = skipDashes(normalized, i);
      const r3 = parseRoundBlock(normalized, i, rank);
      i = r3.next;
      if (r3.allotment?.institute && r3.allotment.course) {
        pushResult(results, r3.allotment);
      }
    }
  }

  return results;
}
