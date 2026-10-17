/**
 * MCC NEET-PG 2026 DNB — official Google Sheet wide layout:
 * Institute Type | Institute | Program | Quota | Open … ST PwD | Total Seats
 */
import fs from "fs";
import { INDIAN_STATES } from "@medcounsel/types";
import { normalizeMccSheetState } from "./mcc-state-names.js";
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import { parseCsvRecords } from "./parse-csv-records.js";
import type { ParsedSeatMatrixRow, ReservationCategoryKey } from "./parse-seat-matrix-pdf.js";
import { reservationSeatsFromBreakdown } from "./parse-seat-matrix-2025.js";

const CODE_TAIL = /\((\d{5,7})\)\s*$/;

function parseIntCell(raw: string | undefined): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function isDnbWideHeader(row: string[]): boolean {
  const joined = row.join("|").toLowerCase();
  return joined.includes("dnb pg counselling") && joined.includes("open pwd") && joined.includes("total seats");
}

function stateFromInstituteText(text: string): string {
  const flat = text.replace(/\s+/g, " ");
  for (const st of INDIAN_STATES) {
    if (flat.includes(st)) return st;
  }
  if (/andhra\s*pradesh/i.test(flat)) return "Andhra Pradesh";
  if (/jammu\s*and\s*kashmir/i.test(flat)) return "Jammu and Kashmir";
  if (/dadra/i.test(flat)) return "Dadra and Nagar Haveli and Daman and Diu";
  return "Unknown";
}

function instituteFromCell(raw: string): { code: string; name: string; state: string } | null {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return null;

  const flat = text.replace(/\s+/g, " ").trim();
  const codeMatch = flat.match(CODE_TAIL);
  if (!codeMatch) return null;
  const code = codeMatch[1];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let name = (lines[0] ?? flat.replace(CODE_TAIL, "")).replace(/,\s*$/, "").trim();
  if (name.length > 120) name = name.slice(0, 120).trim();

  const state = normalizeMccSheetState(stateFromInstituteText(text));
  return { code, name, state };
}

function breakdownFromWideRow(r: string[]): {
  total: number;
  reservationSeats: Partial<Record<ReservationCategoryKey, number>>;
} | null {
  if (r.length < 15) return null;
  const d = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => parseIntCell(r[i]));
  const total = parseIntCell(r[14]);
  const sumD = d.reduce((a, b) => a + b, 0);
  if (total <= 0 && sumD <= 0) return null;

  const breakdown = {
    GENERAL: d[0] + d[1],
    EWS: d[2] + d[3],
    OBC: d[4] + d[5],
    SC: d[6] + d[7],
    ST: d[8] + d[9],
    PWD: d[1] + d[3] + d[5] + d[7] + d[9],
    total: total > 0 ? total : sumD,
  };

  return {
    total: breakdown.total,
    reservationSeats: reservationSeatsFromBreakdown(breakdown),
  };
}

export function parseSeatMatrixDnbCsvText(text: string): ParsedSeatMatrixRow[] {
  const records = parseCsvRecords(text);
  if (!records.length) return [];

  let start = 0;
  if (isDnbWideHeader(records[0])) start = 1;

  const results: ParsedSeatMatrixRow[] = [];

  for (let i = start; i < records.length; i++) {
    const r = records[i];
    const inst = instituteFromCell(r[1] ?? "");
    const program = (r[2] ?? "").trim();
    const quota = (r[3] ?? "").trim();
    if (!inst || !program || !/DNB Quota/i.test(quota)) continue;

    const parsed = breakdownFromWideRow(r);
    if (!parsed || parsed.total <= 0) continue;

    const courseInput = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|\(NBEMS)/i.test(program)
      ? program
      : `DNB ${program}`;
    const { degree, specialty, slug } = parseCourse(courseInput);
    if (!slug) continue;

    results.push({
      instituteCode: inst.code,
      institute: inst.name,
      instituteNorm: normalizeCollegeName(inst.name),
      state: inst.state,
      program: courseInput,
      degree: degree || "DNB",
      specialty: specialty || program,
      specialtySlug: slug,
      quota: "DNB Quota",
      totalSeats: parsed.total,
      category: "DNB",
      reservationSeats: parsed.reservationSeats,
    });
  }

  return results;
}

export function parseSeatMatrixDnbCsvFile(csvPath: string): ParsedSeatMatrixRow[] {
  return parseSeatMatrixDnbCsvText(fs.readFileSync(csvPath, "utf8"));
}
