import {
  mapMccCategory,
  mapMccQuota,
  normalizeCollegeName,
  parseCourse,
} from "./normalizers.js";
import type { ParsedAllotment } from "./parse-mcc-pdf.js";

const QUOTA_FULL =
  /^(All India|Delhi University|Banaras Hindu|Aligarh Muslim|IP University|Management\/Paid|Muslim Minority|Jain Minority|Non-Resident|DNB Quota|Armed Forces)/i;
const QUOTA_ABBR = /^(AIQ|AI|AM|BH|DU|AD|IP|JM|MM|NR|PS|AF|MNG|NRI|AMU|BHU)$/;
const COURSE_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|\(NBEMS\))/i;
const ALLOTTED_CAT = /^(Open|General-EWS|EWS|Other Backward|Schedule Caste|Schedule Tribe|Open Seat|General|BC|EW|GN|SC|ST)/i;

const QUOTA_EXPAND: Record<string, string> = {
  AIQ: "All India",
  AI: "All India",
  AM: "Aligarh Muslim University",
  AMU: "Aligarh Muslim University",
  BH: "Banaras Hindu University",
  BHU: "Banaras Hindu University",
  DU: "Delhi University Quota",
  AD: "DNB Quota",
  IP: "IP University Quota",
  JM: "Jain Minority Quota",
  MM: "Muslim Minority Quota",
  NR: "Non-Resident Indian",
  PS: "Management/Paid Seats Quota",
  MNG: "Management/Paid Seats Quota",
  NRI: "Non-Resident Indian",
  AF: "Armed Forces Medical",
};

const COURSE_ABBR: Record<string, string> = {
  GMED: "M.D. (GENERAL MEDICINE)",
  RADD: "M.D. (RADIO-DIAGNOSIS)",
  PAED: "M.D. (PAEDIATRICS)",
  SURG: "M.S. (GENERAL SURGERY)",
  OBGY: "M.D. (Obst. and Gynae)",
  PATH: "M.D. (PATHOLOGY)",
  ANAE: "M.D. (ANAESTHESIOLOGY)",
  DERM: "M.D. (DERMATOLOGY)",
  PSYY: "M.D. (PSYCHIATRY)",
  ORTH: "M.S. (ORTHOPAEDICS)",
  OPHT: "M.D. (OPHTHALMOLOGY)",
  ENT: "M.D. (ENT)",
};

function pushResult(results: ParsedAllotment[], row: Omit<ParsedAllotment, "instituteNorm" | "specialtySlug">) {
  const { degree, specialty, slug } = parseCourse(row.course);
  results.push({
    ...row,
    degree,
    specialty,
    specialtySlug: slug,
    instituteNorm: normalizeCollegeName(row.institute),
  });
}

function expandQuota(raw: string): string {
  const key = raw.trim().toUpperCase();
  return QUOTA_EXPAND[key] ?? raw;
}

function expandCourse(raw: string): string {
  const key = raw.replace(/\s+/g, "").toUpperCase();
  return COURSE_ABBR[key] ?? raw;
}

function parseCategoryToken(token: string): { allotted: string; candidate: string } {
  const t = token.replace(/Allotted$/i, "").trim();
  // e.g. GNGNNO, OPNOGN, GNEWNO
  if (/^GN/.test(t)) return { allotted: "Open Seat", candidate: "Open Seat" };
  if (/^EW/.test(t)) return { allotted: "General-EWS", candidate: "General-EWS" };
  if (/^BC/.test(t)) return { allotted: "Other Backward Class", candidate: "Other Backward Class" };
  if (/^SC/.test(t)) return { allotted: "Schedule Caste", candidate: "Schedule Caste" };
  if (/^ST/.test(t)) return { allotted: "Schedule Tribe", candidate: "Schedule Tribe" };
  if (/^OPNOGN|^Open/i.test(t)) return { allotted: "Open Seat", candidate: "Open Seat" };
  if (/^OPNOBC/i.test(t)) return { allotted: "Other Backward Class", candidate: "Other Backward Class" };
  return { allotted: t.slice(0, 4), candidate: t.slice(4, 8) || t.slice(0, 4) };
}

/** Standard line-by-line format (2023–2025 R1, 2024 R2, etc.) */
export function parseStandardLines(lines: string[]): ParsedAllotment[] {
  const results: ParsedAllotment[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!/^\d+$/.test(lines[i])) {
      i++;
      continue;
    }
    if (i + 2 >= lines.length) break;

    const rankStr = lines[i + 1];
    const quotaLine = lines[i + 2];
    if (!/^\d+$/.test(rankStr) || !QUOTA_FULL.test(quotaLine)) {
      i++;
      continue;
    }

    const rank = parseInt(rankStr, 10);
    const quota = quotaLine;
    i += 3;

    const instituteParts: string[] = [];
    while (i < lines.length && !COURSE_START.test(lines[i])) {
      if (QUOTA_FULL.test(lines[i]) || /^Allotted$/i.test(lines[i])) break;
      if (/^NEET-PG|^SNo|^Rank|^Note|^Round/.test(lines[i])) break;
      instituteParts.push(lines[i]);
      i++;
    }

    const courseParts: string[] = [];
    while (i < lines.length && !ALLOTTED_CAT.test(lines[i])) {
      if (QUOTA_FULL.test(lines[i]) || /^\d+$/.test(lines[i])) break;
      if (/^Reported|^Not$|^Seat$/.test(lines[i])) break;
      courseParts.push(lines[i]);
      i++;
    }

    if (i >= lines.length) break;
    const allottedCat = lines[i];
    i++;
    if (i >= lines.length) break;
    const candidateCat = lines[i];
    i++;
    if (i < lines.length && /^Allotted$/i.test(lines[i])) i++;

    const institute = instituteParts.join(" ").replace(/\s+/g, " ").trim();
    const course = courseParts.join(" ").replace(/\s+/g, " ").trim();
    if (!institute || !course || !rank) continue;

    pushResult(results, {
      rank,
      quota: mapMccQuota(quota),
      institute,
      course,
      category: mapMccCategory(allottedCat, candidateCat),
      candidateCategory: candidateCat,
    });

    if (results.length % 1000 === 0) {
      process.stdout.write(`  parsed ${results.length} records...\r`);
    }
  }

  return results;
}

const QUOTA_INLINE =
  /(All India|Delhi University|Banaras Hindu|Aligarh Muslim|IP University|Management\/Paid|Muslim Minority|Jain Minority|Non-Resident|DNB Quota|Armed Forces)/i;

const ROW_2021 = /^(\d+)\s+(\d{8,12})\s+(\d+)\s*(All India|Delhi University|Banaras Hindu|Aligarh Muslim|IP University|Management\/Paid|Muslim Minority|Jain Minority|Non-Resident|DNB Quota|Armed Forces)/i;

const CAT_LINE = /^(OPN[A-Z]{2,5}|GN|EW|BC|SC|ST|GNGN|GNEW)[A-Z]{0,4}$/i;

function extractCategoryFromCourseLine(line: string): { course: string; catToken: string } | null {
  const attached = line.match(/^(.+?)(OPN[A-Z]{2,5}|GN[A-Z]{0,4}|EW[A-Z]{0,4}|BC[A-Z]{0,4}|SC[A-Z]{0,4}|ST[A-Z]{0,4})$/i);
  if (attached) return { course: attached[1].trim(), catToken: attached[2] };
  return null;
}

/** 2021-style inline rows with roll numbers — ~18k allotments per PDF */
export function parse2021Inline(lines: string[]): ParsedAllotment[] {
  const results: ParsedAllotment[] = [];
  let i = 0;

  while (i < lines.length) {
    const m = lines[i].match(ROW_2021);
    if (!m) {
      i++;
      continue;
    }

    const rank = parseInt(m[3], 10);
    const quota = m[4];
    i++;

    const instituteParts: string[] = [];
    while (i < lines.length && !COURSE_START.test(lines[i]) && !ROW_2021.test(lines[i])) {
      if (/^Page \d+|^S\. No|^ALLOTTED|^CATEGORY|^CANDIDATE/.test(lines[i])) {
        i++;
        continue;
      }
      instituteParts.push(lines[i]);
      i++;
    }

    if (i >= lines.length || ROW_2021.test(lines[i])) continue;

    const courseParts: string[] = [];
    let catToken = "OPNOGN";

    while (i < lines.length && !ROW_2021.test(lines[i])) {
      if (/^Page \d+|^S\. No|^ALLOTTED|^CATEGORY|^CANDIDATE|^--/.test(lines[i])) {
        i++;
        continue;
      }

      const attached = extractCategoryFromCourseLine(lines[i]);
      if (attached) {
        courseParts.push(attached.course);
        catToken = attached.catToken;
        i++;
        break;
      }
      if (CAT_LINE.test(lines[i])) {
        catToken = lines[i];
        i++;
        break;
      }

      // Multi-line courses: keep reading until category or next row
      courseParts.push(lines[i]);
      i++;
    }

    const { allotted, candidate } = parseCategoryToken(catToken);
    const institute = instituteParts.join(" ").replace(/\s+/g, " ").trim();
    const course = courseParts.join(" ").replace(/\s+/g, " ").trim();
    if (!institute || !course || !rank) continue;

    pushResult(results, {
      rank,
      quota: mapMccQuota(quota),
      institute,
      course,
      category: mapMccCategory(allotted, candidate),
      candidateCategory: candidate,
    });

    if (results.length % 2000 === 0) {
      process.stdout.write(`  parsed ${results.length} records...\r`);
    }
  }

  return results;
}

/** 2020-style compressed rows: `11AIQ`, institute..., course..., `GNGNNOAllotted` */
export function parse2020Compressed(lines: string[]): ParsedAllotment[] {
  const results: ParsedAllotment[] = [];
  const rowStart = /^(\d+)(AIQ|MNG|NRI|MM|JM|DU|AMU|BHU|IP)$/i;

  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(rowStart);
    if (!m) {
      i++;
      continue;
    }

    const digits = m[1];
    const quota = expandQuota(m[2]);
    const half = Math.floor(digits.length / 2);
    const rank = parseInt(digits.slice(half), 10);
    i++;

    const instituteParts: string[] = [];
    while (i < lines.length && !COURSE_START.test(lines[i]) && !rowStart.test(lines[i])) {
      instituteParts.push(lines[i]);
      i++;
    }

    if (i >= lines.length || rowStart.test(lines[i])) continue;

    const courseParts: string[] = [];
    while (i < lines.length && !/^(GNGN|GNEW|GN|EW|BC|SC|ST|OPN)/i.test(lines[i]) && !rowStart.test(lines[i])) {
      courseParts.push(lines[i]);
      i++;
    }

    if (i >= lines.length) continue;
    const { allotted, candidate } = parseCategoryToken(lines[i]);
    i++;

    const institute = instituteParts.join(" ").replace(/\s+/g, " ").trim();
    const course = courseParts.join(" ").replace(/\s+/g, " ").trim();
    if (!institute || !course || !rank) continue;

    pushResult(results, {
      rank,
      quota: mapMccQuota(quota),
      institute,
      course,
      category: mapMccCategory(allotted, candidate),
      candidateCategory: candidate,
    });
  }

  return results;
}

/**
 * Upgrade rounds (2025 R2/R3) with abbreviation rows.
 * Only extracts rows where Round N has a numeric AIR rank (rare in some PDFs).
 */
export function parseUpgradeAbbrev(lines: string[]): ParsedAllotment[] {
  const results: ParsedAllotment[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!/^\d+$/.test(lines[i])) {
      i++;
      continue;
    }
    const sno = parseInt(lines[i], 10);
    if (sno > 500000) {
      i++;
      continue;
    }
    i++;

    // Skip R1 block until Reported / Not Reported / Seat Surrendered
    while (i < lines.length && !/^(Reported|Not|Seat)$/.test(lines[i])) {
      if (/^\d+$/.test(lines[i]) && parseInt(lines[i], 10) === sno + 1) break;
      i++;
    }
    if (i >= lines.length) break;

    if (lines[i] === "Not") i += 2;
    else if (lines[i] === "Seat") i += 2;
    else if (lines[i] === "Reported") i++;

    // Round 2/3 section: rank (optional), quota, institute, course, category
    if (i >= lines.length || lines[i] === "-") {
      // skip dash padding until next sno
      while (i < lines.length && lines[i] === "-") i++;
      while (i < lines.length && !/^\d+$/.test(lines[i])) i++;
      continue;
    }

    let rank: number | null = null;
    if (/^\d{2,6}$/.test(lines[i]) && QUOTA_ABBR.test(lines[i + 1] ?? "")) {
      rank = parseInt(lines[i], 10);
      i++;
    } else if (QUOTA_ABBR.test(lines[i] ?? "") || QUOTA_FULL.test(lines[i] ?? "")) {
      rank = null;
    } else {
      i++;
      continue;
    }

    if (!rank) {
      while (i < lines.length && !/^\d+$/.test(lines[i])) i++;
      continue;
    }

    const quota = expandQuota(lines[i]);
    i++;

    const instituteParts: string[] = [];
    while (
      i < lines.length &&
      !/^[A-Z]{2,6}$/.test(lines[i]) &&
      !COURSE_START.test(lines[i]) &&
      !QUOTA_ABBR.test(lines[i])
    ) {
      if (/^\d+$/.test(lines[i])) break;
      instituteParts.push(lines[i]);
      i++;
    }

    let courseRaw = lines[i] ?? "";
    if (/^[A-Z]{2,6}$/.test(courseRaw) && COURSE_ABBR[courseRaw.replace(/\s+/g, "")]) {
      courseRaw = expandCourse(courseRaw);
      i++;
    } else {
      const courseParts: string[] = [];
      while (i < lines.length && !ALLOTTED_CAT.test(lines[i]) && !/^(Open|GN|EW|BC|SC|ST)/i.test(lines[i])) {
        if (/^\d+$/.test(lines[i]) || QUOTA_ABBR.test(lines[i])) break;
        courseParts.push(lines[i]);
        i++;
      }
      courseRaw = courseParts.join(" ");
      if (i < lines.length && /^[A-Z]{2,6}$/.test(lines[i]) && !ALLOTTED_CAT.test(lines[i])) i++;
    }

    if (i >= lines.length) continue;
    const allottedCat = lines[i];
    i++;
    const candidateCat = i < lines.length && !/^\d+$/.test(lines[i]) ? lines[i] : allottedCat;
    if (candidateCat === lines[i]) i++;

    const institute = instituteParts.join(" ").replace(/\s+/g, " ").trim();
    const course = courseRaw.replace(/\s+/g, " ").trim();
    if (!institute || !course) continue;

    pushResult(results, {
      rank,
      quota: mapMccQuota(quota),
      institute,
      course,
      category: mapMccCategory(allottedCat, candidateCat),
      candidateCategory: candidateCat,
    });
  }

  return results;
}

export function detectAndParse(text: string): ParsedAllotment[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (/S\.?\s*No\s+ROLL\s+NO\s+RANK/i.test(text) || /\d{10}\s+\d+\s*(All India|AIQ)/i.test(text)) {
    const r = parse2021Inline(lines);
    if (r.length > 100) return r;
  }

  if (/SNoRankAllotted/i.test(text.replace(/\s+/g, "")) || lines.some((l) => /^\d+(AIQ|MNG|NRI|MM|JM|DU|AMU|BHU|IP)$/i.test(l))) {
    const r = parse2020Compressed(lines);
    if (r.length) return r;
  }

  if (/Round 1[\s\S]{0,80}Round 2/i.test(text) || /Round 2[\s\S]{0,80}Round 3/i.test(text)) {
    const upgrade = parseUpgradeAbbrev(lines);
    if (upgrade.length) return upgrade;
  }

  return parseStandardLines(lines);
}
