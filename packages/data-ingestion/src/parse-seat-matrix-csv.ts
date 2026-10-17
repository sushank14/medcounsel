/**
 * MCC NEET-PG seat matrix from official Google Sheet / CSV export.
 * Columns: StateName, InstituteType, Institute, Quota, Branch, Category, TotalSeats
 */
import fs from "fs";
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import { parseCsvRecords } from "./parse-csv-records.js";
import type {
  ParsedSeatMatrixRow,
  ReservationCategoryKey,
  SeatMatrixCategory,
} from "./parse-seat-matrix-pdf.js";

const CODE_TAIL = /\((\d{5,7})\)\s*$/;

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

function parseCategoryCell(raw: string): { reservation: ReservationCategoryKey; seatsFromCat: number | null } {
  const m = raw.trim().match(/^(OP|EW|BC|SC|ST)\s+(NO|PH)(\d+)?\s*$/i);
  if (!m) {
    return { reservation: "GENERAL", seatsFromCat: null };
  }
  const seats = m[3] ? parseInt(m[3], 10) : null;
  return { reservation: reservationFrom(m[1], m[2]), seatsFromCat: seats };
}

function instituteFromCell(raw: string): { code: string; name: string } | null {
  const flat = raw.replace(/\s+/g, " ").trim();
  const m = flat.match(CODE_TAIL);
  if (!m) return null;
  const name = flat.replace(CODE_TAIL, "").replace(/\s+/g, " ").trim();
  return { code: m[1], name };
}

function findDataStart(records: string[][]): number {
  for (let i = 0; i < records.length; i++) {
    const first = records[i][0]?.trim() ?? "";
    if (/^StateName$/i.test(first) || first.endsWith("StateName")) return i;
    if (/^Andaman|^Maharashtra|^Delhi|^Uttar Pradesh/i.test(first) && records[i].length >= 7) return i;
  }
  return 1;
}

export function parseSeatMatrixCsvText(
  text: string,
  matrixCategory: SeatMatrixCategory
): ParsedSeatMatrixRow[] {
  const records = parseCsvRecords(text);
  const start = findDataStart(records);
  const results: ParsedSeatMatrixRow[] = [];

  for (let i = start; i < records.length; i++) {
    const r = records[i];
    if (r.length < 7) continue;

    const state = r[0]?.trim() || "Unknown";
    const instituteRaw = r[2]?.trim() ?? "";
    const quota = r[3]?.trim() ?? "";
    const program = r[4]?.trim() ?? "";
    const categoryRaw = r[5]?.trim() ?? "";
    const totalSeats = parseInt(String(r[6] ?? "").trim(), 10);

    if (!instituteRaw || !program || !Number.isFinite(totalSeats) || totalSeats <= 0) continue;

    const inst = instituteFromCell(instituteRaw);
    if (!inst) continue;

    const { reservation, seatsFromCat } = parseCategoryCell(categoryRaw);
    const seats = seatsFromCat && seatsFromCat > 0 ? seatsFromCat : totalSeats;
    if (seats <= 0) continue;

    const { degree, specialty, slug } = parseCourse(program);
    results.push({
      instituteCode: inst.code,
      institute: inst.name,
      instituteNorm: normalizeCollegeName(inst.name),
      state,
      program,
      degree,
      specialty,
      specialtySlug: slug,
      quota,
      totalSeats: seats,
      category: matrixCategory,
      reservationSeats: { [reservation]: seats },
    });
  }

  return results;
}

export function parseSeatMatrixCsvFile(
  csvPath: string,
  matrixCategory: SeatMatrixCategory
): ParsedSeatMatrixRow[] {
  const text = fs.readFileSync(csvPath, "utf8");
  return parseSeatMatrixCsvText(text, matrixCategory);
}
