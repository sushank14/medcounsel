/**
 * MCC NEET-PG 2026 deemed seat matrix — State / Institute / Quota / Branch / Category columns.
 */
import { normalizeCollegeName, parseCourse } from "./normalizers.js";
import type { ParsedSeatMatrixRow } from "./parse-seat-matrix-pdf.js";

const PROGRAM_START = /^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA|MD\/MS)/i;
const SKIP =
  /^(Page \d+|StateNameInstituteType|FINAL DEEMED|State$|Name$|InstituteType$|Institute$|Quota$|Branch$|Category$|TotalSeats$)/i;

const DEEMED_QUOTA =
  /(Non-Resident Indian|Self-Financed Merit Seat|Management\/Paid Seats Quota|Management\/Paid|Muslim Minority Quota|Jain Minority Quota)/i;

const CAT_TAIL = /OP\s*(NO|EW|BC|SC|ST|GN|PH)\s*(\d+)\s*$/i;

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

export function is2026DeemedSeatMatrixFormat(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  return (
    /StateNameInstituteTypeInstituteQuotaBranchCategory/i.test(compact) &&
    /DeemedUniversity/i.test(compact)
  );
}

function instituteFromBlock(lines: string[], blockStart: number, codeLineIdx: number): string {
  const nameParts: string[] = [];
  for (let n = blockStart + 1; n <= codeLineIdx; n++) {
    const line = lines[n];
    if (/Deemed University/i.test(line)) continue;
    nameParts.push(line.replace(/\(\d{5,7}\).*$/, "").trim());
  }
  return nameParts.join(" ").replace(/\s+/g, " ").trim();
}

export function parse2026Deemed(lines: string[]): ParsedSeatMatrixRow[] {
  const results: ParsedSeatMatrixRow[] = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.test(line)) continue;

    if (/Deemed University/i.test(line) && !PROGRAM_START.test(line)) {
      blockStart = i;
      continue;
    }

    const embedded = line.match(
      new RegExp(`^(${DEEMED_QUOTA.source})(.+?)${CAT_TAIL.source}$`, "i")
    );
    if (embedded) {
      const quota = embedded[1].trim();
      const program = embedded[2].replace(/\s+/g, " ").trim();
      const totalSeats = parseInt(embedded[4], 10);
      let instituteCode = "";
      let institute = "";
      let state = "Unknown";
      for (let k = i - 1; k >= blockStart; k--) {
        const cm = lines[k].match(/\((\d{5,7})\)/);
        if (cm) {
          instituteCode = cm[1];
          institute = instituteFromBlock(lines, blockStart, k);
          const sm = lines[blockStart].match(/^(.+?)\s+Deemed University/i);
          if (sm) state = sm[1].trim();
          break;
        }
      }
      if (instituteCode && PROGRAM_START.test(program)) {
        pushRow(results, {
          instituteCode,
          institute,
          state,
          program,
          quota,
          totalSeats,
          category: "DEEMED",
        });
      }
      continue;
    }

    const seatOnly = line.match(/^OP\s*(NO|EW|BC|SC|ST|GN|PH)\s*(\d+)\s*$/i);
    if (!seatOnly) continue;

    const totalSeats = parseInt(seatOnly[2], 10);
    if (totalSeats <= 0) continue;

    let j = i - 1;
    const programParts: string[] = [];
    while (j > blockStart && !DEEMED_QUOTA.test(lines[j]) && !lines[j].match(/\(\d{5,7}\)/)) {
      if (!SKIP.test(lines[j]) && !/Deemed University/i.test(lines[j])) {
        programParts.unshift(lines[j]);
      }
      j--;
    }

    let quota = "Management/Paid Seats Quota";
    let program = programParts.join(" ").replace(/\s+/g, " ").trim();

    if (j > blockStart && DEEMED_QUOTA.test(lines[j])) {
      const qm = lines[j].match(DEEMED_QUOTA);
      if (qm) quota = qm[0];
      j--;
    }

    let instituteCode = "";
    let institute = "";
    let state = "Unknown";
    for (let k = j; k >= blockStart; k--) {
      const cm = lines[k].match(/\((\d{5,7})\)/);
      if (cm) {
        instituteCode = cm[1];
        institute = instituteFromBlock(lines, blockStart, k);
        const sm = lines[blockStart].match(/^(.+?)\s+Deemed University/i);
        if (sm) state = sm[1].trim();
        break;
      }
    }

    if (!instituteCode || !program || !PROGRAM_START.test(program)) continue;

    pushRow(results, {
      instituteCode,
      institute,
      state,
      program,
      quota,
      totalSeats,
      category: "DEEMED",
    });
  }

  return results;
}
