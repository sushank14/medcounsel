import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { detectAndParse } from "./mcc-format-parsers.js";

export interface ParsedAllotment {
  rank: number;
  quota: string;
  institute: string;
  instituteNorm: string;
  course: string;
  degree: string;
  specialty: string;
  specialtySlug: string;
  category: string;
  candidateCategory: string;
}

export interface CutoffAggregate {
  year: number;
  round: string;
  institute: string;
  instituteNorm: string;
  course: string;
  degree: string;
  specialty: string;
  specialtySlug: string;
  category: string;
  quota: string;
  openingRank: number;
  closingRank: number;
  seats: number;
}

export function parseAllotmentText(text: string): ParsedAllotment[] {
  return detectAndParse(text);
}

export function aggregateCutoffs(
  allotments: ParsedAllotment[],
  year: number,
  round: string
): CutoffAggregate[] {
  const map = new Map<string, CutoffAggregate>();

  for (const a of allotments) {
    const key = `${a.instituteNorm}|${a.specialtySlug}|${a.category}|${a.quota}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        year,
        round,
        institute: a.institute,
        instituteNorm: a.instituteNorm,
        course: a.course,
        degree: a.degree,
        specialty: a.specialty,
        specialtySlug: a.specialtySlug,
        category: a.category,
        quota: a.quota,
        openingRank: a.rank,
        closingRank: a.rank,
        seats: 1,
      });
    } else {
      existing.openingRank = Math.min(existing.openingRank, a.rank);
      existing.closingRank = Math.max(existing.closingRank, a.rank);
      existing.seats += 1;
    }
  }

  return [...map.values()];
}

export async function parseMccPdfFile(
  filePath: string,
  year: number,
  round: string
): Promise<{ allotments: ParsedAllotment[]; cutoffs: CutoffAggregate[] }> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  const allotments = parseAllotmentText(data.text);
  const cutoffs = aggregateCutoffs(allotments, year, round);
  return { allotments, cutoffs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const year = parseInt(process.argv[3] ?? "2023", 10);
  const round = process.argv[4] ?? "R1";
  const { allotments, cutoffs } = await parseMccPdfFile(file, year, round);
  console.log(`\nParsed ${allotments.length} allotments → ${cutoffs.length} cutoff groups`);
  const cats = [...new Set(cutoffs.map((c) => c.category))];
  console.log("Categories:", cats.join(", "));
  console.log(JSON.stringify(cutoffs.slice(0, 3), null, 2));
}
