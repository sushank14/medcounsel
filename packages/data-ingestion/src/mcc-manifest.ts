/** Official MCC NEET-PG final allotment PDFs — sourced from mcc.nic.in */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface MccDocument {
  year: number;
  round: "R1" | "R2" | "R3" | "STRAY" | "SPECIAL";
  title: string;
  url: string;
  fileName: string;
  /** Provisional MCC results — imported as NEEDS_REVIEW until final PDF replaces this entry. */
  provisional?: boolean;
}

/** Curated entries (incl. latest 2025 counselling — may not yet be on archive page) */
const MCC_MANUAL_PDFS: MccDocument[] = [
  {
    year: 2026,
    round: "R1",
    provisional: true,
    title: "Provisional NEET-PG Counselling Seats Allotment 2026 Round 1 (AIQ)",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610231277301968.pdf",
    fileName: "2026-r1-provisional.pdf",
  },
  {
    year: 2025,
    round: "R1",
    title: "Final Result of Round 1 for PG Counselling 2025",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2025/11/202511221303622410.pdf",
    fileName: "2025-r1-final.pdf",
  },
  {
    year: 2025,
    round: "R2",
    title: "Final Result for Round 2 of PG counselling 2025",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2025/12/202512172132273940.pdf",
    fileName: "2025-r2-final.pdf",
  },
  {
    year: 2025,
    round: "R3",
    title: "Final Result for Round-III of NEET PG Counselling 2025",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/02/20260206892439077.pdf",
    fileName: "2025-r3-final.pdf",
  },
  {
    year: 2025,
    round: "STRAY",
    title: "Final Result for Stray Round of PG counselling 2025",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/02/20260223177387794.pdf",
    fileName: "2025-stray-final.pdf",
  },
  {
    year: 2023,
    round: "SPECIAL",
    title: "Final Allotment Result Special Stray Round PG Counselling 2023",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2023/11/2023112564.pdf",
    fileName: "2023-special-final.pdf",
  },
];

function loadGeneratedManifest(): MccDocument[] {
  const generatedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "mcc-manifest.generated.json");
  if (!fs.existsSync(generatedPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(generatedPath, "utf8")) as MccDocument[];
  } catch {
    return [];
  }
}

/** Merge manual + auto-discovered archive PDFs. Manual entries win on year+round conflicts. */
export function getMccManifest(): MccDocument[] {
  const generated = loadGeneratedManifest();
  const byKey = new Map<string, MccDocument>();

  for (const doc of generated) {
    byKey.set(`${doc.year}-${doc.round}`, doc);
  }
  for (const doc of MCC_MANUAL_PDFS) {
    byKey.set(`${doc.year}-${doc.round}`, doc);
  }

  return [...byKey.values()].sort((a, b) => b.year - a.year || a.round.localeCompare(b.round));
}

/** @deprecated use getMccManifest() — kept for backwards compatibility */
export const MCC_ALLOTMENT_PDFS: MccDocument[] = getMccManifest();
