import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { slugify } from "./normalizers.js";
import {
  MAH_COLLEGE_SUFFIXES,
  normalizeCity,
  resolveMahCollege,
  sanitizeCollegeRaw,
} from "./maharashtra-colleges.js";

export interface ParsedMahSelection {
  smlRank: number;
  subjectCode: string;
  subject: string;
  collegeRaw: string;
  cityRaw: string;
  seatCategory: string;
  candidateCategory: string;
}

export interface MahCutoffAggregate {
  year: number;
  round: string;
  college: string;
  collegeNorm: string;
  city: string;
  subject: string;
  specialtySlug: string;
  degree: string;
  category: string;
  quota: string;
  openingRank: number;
  closingRank: number;
  seats: number;
}

const CANDIDATE_CATS = new Set(["OBC", "SEBC", "EWS", "SC", "ST", "NTB", "NTC", "NTD", "VJA", "ORC", "PWD", "IB", "I"]);

const SEAT_CATEGORIES = [
  "EMSEBC", "EMNTB", "EMNTD", "EMOBC", "EMVJA",
  "PH-SEBC", "PH-OBC", "PH-NT3", "PH-SC",
  "Orphan-C", "MINORIT", "OPEN", "OBC", "EWS", "SC", "ST", "SEBC",
  "NTB", "NTC", "NTD", "VJA", "PH",
];

const SUBJECT_MAP: [RegExp, string][] = [
  [/CHEST\s*&\s*TB|RESPIR|PULMON/i, "Respiratory Medicine"],
  [/EMERGENCY\s*&\s*CRITICAL|EMERGENCY/i, "Emergency Medicine"],
  [/FORENSIC/i, "Forensic Medicine"],
  [/COMMUNITY\s*HEALTH|PSM/i, "Community Medicine"],
  [/MEDICINE/i, "General Medicine"],
  [/RADIOLOGY|RADIO\s*DIAG/i, "Radiodiagnosis"],
  [/SKIN\s*&\s*VD|SKIN|DERM/i, "Dermatology"],
  [/PAEDIATRIC|PEDIAT/i, "Pediatrics"],
  [/SURGERY/i, "General Surgery"],
  [/OBGY|O\.?B\.?G|OBSTET/i, "Obstetrics & Gynecology"],
  [/ORTHOP/i, "Orthopedics"],
  [/ANAESTH|ANESTH/i, "Anaesthesiology"],
  [/ENT|OTO/i, "ENT"],
  [/OPHTHAL/i, "Ophthalmology"],
  [/PSYCHI/i, "Psychiatry"],
  [/PATHO/i, "Pathology"],
];

export function mapMahCategory(seatCategory: string, candidateCategory: string): string {
  const s = `${seatCategory} ${candidateCategory}`.toUpperCase();
  if (s.includes("PH") || s.includes("PWD")) return "PWD";
  if (s.includes("EWS")) return "EWS";
  if (s.includes("OBC") || s.includes("SEBC") || s.includes("NTB") || s.includes("NTC") || s.includes("NTD") || s.includes("VJA")) return "OBC";
  if (/\bSC\b/.test(s)) return "SC";
  if (/\bST\b/.test(s)) return "ST";
  return "GENERAL";
}

function parseSubject(raw: string): { subject: string; degree: string; slug: string } {
  const cleaned = raw.replace(/^\d{4}S\s*:\s*/i, "").trim();
  let subject = cleaned;
  for (const [re, name] of SUBJECT_MAP) {
    if (re.test(cleaned)) {
      subject = name;
      break;
    }
  }
  const degree = /SURGERY|ORTHOP/i.test(cleaned) && !/GENERAL/i.test(subject) ? "MS" : "MD";
  return { subject, degree, slug: slugify(`${degree}-${subject}`) };
}

/** Strip college code accidentally merged into subject when PDF columns collapse */
function splitEmbeddedCollege(subjectRaw: string): { subjectRaw: string; embeddedCollege?: string } {
  let subject = subjectRaw.trim();
  for (const abbrev of MAH_COLLEGE_SUFFIXES) {
    const re = new RegExp(`\\s+${abbrev.replace(/[&]/g, "\\$&")}\\s*$`, "i");
    if (re.test(subject)) {
      subject = subject.replace(re, "").trim();
      return { subjectRaw: subject, embeddedCollege: abbrev };
    }
  }
  return { subjectRaw: subject };
}

function extractQuota(text: string): { quota: string; remainder: string } {
  let s = text.replace(/\s*\((EMD|EMR|Min|I|IB)\)\s*/gi, " ").trim();
  const upper = s.toUpperCase();
  for (const token of SEAT_CATEGORIES) {
    if (upper.endsWith(` ${token}`) || upper === token) {
      const quota = token;
      const remainder = s.slice(0, s.length - token.length).trim();
      return { quota, remainder };
    }
  }
  const words = s.split(/\s+/);
  const quota = words.pop() ?? "OPEN";
  return { quota, remainder: words.join(" ") };
}

/** Parse collapsed single-column tail e.g. "HBT & COOP JUHU, MUMB OPEN" */
function parseCollapsedTail(col: string): { collegeRaw: string; cityRaw: string; seatCategory: string } | null {
  const { quota, remainder } = extractQuota(col);
  const sortedAbbrevs = [...MAH_COLLEGE_SUFFIXES].sort((a, b) => b.length - a.length);

  for (const abbrev of sortedAbbrevs) {
    const re = new RegExp(`^(${abbrev.replace(/[&]/g, "\\$&")})(?:\\s+(.*))?$`, "i");
    const m = remainder.match(re);
    if (m) {
      const cityPart = (m[2] ?? "").trim();
      const cityRaw = cityPart.split(/\s+/).slice(0, 2).join(" ") || "Maharashtra";
      return { collegeRaw: m[1], cityRaw, seatCategory: quota };
    }
  }

  const words = remainder.split(/\s+/);
  if (words.length >= 2) {
    const cityRaw = words.pop()!;
    return { collegeRaw: words.join(" "), cityRaw, seatCategory: quota };
  }
  return null;
}

function isQuotaToken(value: string): boolean {
  const token = value.trim().split(/\s+/)[0].toUpperCase();
  return SEAT_CATEGORIES.some((q) => token === q || token.startsWith(q));
}

function parseTail(tail: string): { collegeRaw: string; cityRaw: string; seatCategory: string } | null {
  const cleaned = tail.replace(/\s*\((No Change|EMD|EMR|Min|I|IB)\)\s*/gi, " ").trim();
  const cols = cleaned.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);

  if (cols.length === 0) return null;
  if (cols.length === 1) return parseCollapsedTail(cols[0]);

  const lastCol = cols[cols.length - 1];
  const seatCategory = extractQuota(lastCol).quota;

  // [college, quota] — city comes from college map
  if (cols.length === 2 && isQuotaToken(lastCol)) {
    return { collegeRaw: sanitizeCollegeRaw(cols[0]), cityRaw: "", seatCategory };
  }

  // [college, city, quota]
  if (cols.length >= 3 && isQuotaToken(lastCol)) {
    return {
      collegeRaw: sanitizeCollegeRaw(cols.slice(0, -2).join(" ")),
      cityRaw: cols[cols.length - 2],
      seatCategory,
    };
  }

  return parseCollapsedTail(cleaned);
}

export function parseMahSelectionLines(lines: string[]): ParsedMahSelection[] {
  const results: ParsedMahSelection[] = [];

  for (const line of lines) {
    if (!/^\d+\s+\d+\s+258\d{6}/.test(line)) continue;
    if (/Choice Not Available/i.test(line)) continue;

    const head = line.match(/^(\d+)\s+(\d+)\s+258\d{6}\s+/);
    if (!head) continue;

    const smlRank = parseInt(head[2], 10);
    const rest = line.slice(head[0].length);
    const subjStart = rest.search(/\d{4}S\s*:/);
    if (subjStart < 0) continue;

    const namePart = rest.slice(0, subjStart).trim();
    const afterSubj = rest.slice(subjStart);

    const subjMatch = afterSubj.match(/^(\d{4}S\s*:\s*.+?)(?=\s{2,})/);
    if (!subjMatch) continue;

    let subjectLine = subjMatch[1];
    const tail = afterSubj.slice(subjMatch[1].length).trim();

    const { subjectRaw, embeddedCollege } = splitEmbeddedCollege(subjectLine);
    subjectLine = subjectRaw;

    const nameTokens = namePart.split(/\s+/);
    let candidateCategory = "GENERAL";
    if (nameTokens.length && CANDIDATE_CATS.has(nameTokens[nameTokens.length - 1])) {
      candidateCategory = nameTokens[nameTokens.length - 1];
    }

    const parsedTail = parseTail(tail);
    if (!parsedTail) continue;

    const collegeRaw = embeddedCollege ?? parsedTail.collegeRaw;
    const subjectCode = subjectLine.match(/^(\d{4}S)/)?.[1] ?? "";

    results.push({
      smlRank,
      subjectCode,
      subject: subjectLine,
      collegeRaw: sanitizeCollegeRaw(collegeRaw),
      cityRaw: parsedTail.cityRaw,
      seatCategory: parsedTail.seatCategory,
      candidateCategory,
    });
  }

  return results;
}

export function aggregateMahCutoffs(
  selections: ParsedMahSelection[],
  year: number,
  round: string
): MahCutoffAggregate[] {
  const map = new Map<string, MahCutoffAggregate>();

  for (const s of selections) {
    if (!s.collegeRaw || s.collegeRaw.startsWith("&")) continue;

    const { name, city, norm } = resolveMahCollege(s.collegeRaw, s.cityRaw);
    const { subject, degree, slug } = parseSubject(s.subject);
    const category = mapMahCategory(s.seatCategory, s.candidateCategory);
    const branchKey = s.subjectCode?.trim() || slug;
    const key = `${norm}|${branchKey}|${category}|STATE`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        year,
        round,
        college: name,
        collegeNorm: norm,
        city: normalizeCity(city),
        subject,
        specialtySlug: slug,
        degree,
        category,
        quota: "STATE",
        openingRank: s.smlRank,
        closingRank: s.smlRank,
        seats: 1,
      });
    } else {
      existing.openingRank = Math.min(existing.openingRank, s.smlRank);
      existing.closingRank = Math.max(existing.closingRank, s.smlRank);
      existing.seats += 1;
    }
  }

  return [...map.values()];
}

export async function parseMaharashtraPdfFile(
  filePath: string,
  year: number,
  round: string
): Promise<{ selections: ParsedMahSelection[]; cutoffs: MahCutoffAggregate[] }> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const selections = parseMahSelectionLines(lines);
  const cutoffs = aggregateMahCutoffs(selections, year, round);
  return { selections, cutoffs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const year = parseInt(process.argv[3] ?? "2025", 10);
  const round = process.argv[4] ?? "R1";
  const { selections, cutoffs } = await parseMaharashtraPdfFile(file, year, round);
  const bad = selections.filter((s) => s.collegeRaw.startsWith("&"));
  console.log(`Parsed ${selections.length} selections → ${cutoffs.length} cutoffs (${bad.length} skipped bad)`);
  console.log(JSON.stringify(cutoffs.slice(0, 5), null, 2));
}
