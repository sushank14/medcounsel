/** Official MCC NEET-PG seat matrix PDFs — complete participating institute lists */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface SeatMatrixDocument {
  year: number;
  category: "AIQ" | "DEEMED" | "CENTRAL" | "DNB";
  title: string;
  url: string;
  fileName: string;
  /** Official Google Sheet CSV (preferred over PDF when present). */
  csvFileName?: string;
  googleSheetId?: string;
  googleSheetGid?: string;
}

const MANUAL: SeatMatrixDocument[] = [
  {
    year: 2026,
    category: "AIQ",
    title: "FINAL ALL INDIA QUOTA SEATS MATRIX PG 2026 COUNSELLING (MD MS)",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610151676193504.pdf",
    fileName: "2026-aiq-seat-matrix.pdf",
    csvFileName: "2026-aiq-seat-matrix-sheet.csv",
    googleSheetId: "1pXBK3pF0dP9IZ4h_Q5jTAEmIO2HuiXXMFAlkU16X0Qo",
    googleSheetGid: "1217711414",
  },
  {
    year: 2026,
    category: "DEEMED",
    title: "FINAL DEEMED SEATS MATRIX PG COUNSELLING 2026 (MD MS)",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/20261015907178910.pdf",
    fileName: "2026-deemed-seat-matrix.pdf",
  },
  {
    year: 2026,
    category: "CENTRAL",
    title: "FINAL CENTRAL INTERNAL QUOTA SEATS MATRIX PG COUNSELLING 2026 (MD MS)",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610151906520168.pdf",
    fileName: "2026-central-seat-matrix.pdf",
  },
  {
    year: 2026,
    category: "DNB",
    title: "FINAL SEATS MATRIX DNB PG COUNSELLING 2026",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610151482599908.pdf",
    fileName: "2026-dnb-seat-matrix.pdf",
    csvFileName: "2026-dnb-seat-matrix-sheet.csv",
    googleSheetId: "1gTVhgFGA00nEBi7OhvfXqNc-0j25QRMTkCsVRZnP_l8",
    googleSheetGid: "258471497",
  },
  {
    year: 2025,
    category: "AIQ",
    title: "FINAL SEAT MATRIX FOR ROUND 1 AIQ MD/MS/DIPLOMA PG 2025",
    url: "https://cdnbbsr.s3waas.gov.in/s33dd13c7093362886b8ce5923426fdad4/uploads/2025/11/202511071301088057.pdf",
    fileName: "2025-aiq-seat-matrix.pdf",
  },
  {
    year: 2025,
    category: "DEEMED",
    title: "Deemed University Seats Matrix PG 2025 Counselling",
    url: "https://medicaldialogues.in/pdf_upload/3-306030.pdf",
    fileName: "2025-deemed-seat-matrix.pdf",
  },
  {
    year: 2025,
    category: "CENTRAL",
    title: "Central Internal Quota Seats Matrix PG 2025 Counselling",
    url: "https://medicaldialogues.in/pdf_upload/2-306029.pdf",
    fileName: "2025-central-seat-matrix.pdf",
  },
  {
    year: 2025,
    category: "DNB",
    title: "FINAL DNB SEAT MATRIX FOR PG 2025",
    url: "https://medicaldialogues.in/pdf_upload/4-306032.pdf",
    fileName: "2025-dnb-seat-matrix.pdf",
  },
  {
    year: 2024,
    category: "AIQ",
    title: "All India Quota Seats Matrix PG 2024 Counselling",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2024/11/2024111122.pdf",
    fileName: "2024-aiq-seat-matrix.pdf",
  },
  {
    year: 2024,
    category: "DEEMED",
    title: "Deemed University Seats Matrix PG 2024 Counselling",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2024/11/2024110963.pdf",
    fileName: "2024-deemed-seat-matrix.pdf",
  },
  {
    year: 2024,
    category: "CENTRAL",
    title: "Central Internal Quota Seats Matrix PG 2024 Counselling",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2024/11/2024110917.pdf",
    fileName: "2024-central-seat-matrix.pdf",
  },
  {
    year: 2024,
    category: "DNB",
    title: "FINAL DNB SEAT MATRIX FOR PG 2024",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2024/11/2024111377.pdf",
    fileName: "2024-dnb-seat-matrix.pdf",
  },
  {
    year: 2023,
    category: "AIQ",
    title: "FINAL AIQ SEAT MATRIX FOR PG 2023 MD MS",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2023/07/2023073097.pdf",
    fileName: "2023-aiq-seat-matrix.pdf",
  },
  {
    year: 2023,
    category: "DEEMED",
    title: "FINAL DEEMED UNIV. SEAT MATRIX FOR PG 2023 MD MS",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2023/07/2023072986.pdf",
    fileName: "2023-deemed-seat-matrix.pdf",
  },
  {
    year: 2023,
    category: "CENTRAL",
    title: "FINAL CENTRAL INERNAL SEAT MATRIX FOR PG 2023 DU IP AMU BHU",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2023/07/2023072950.pdf",
    fileName: "2023-central-seat-matrix.pdf",
  },
  {
    year: 2023,
    category: "DNB",
    title: "FINAL DNB SEAT MATRIX FOR PG 2023",
    url: "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2023/07/2023073045.pdf",
    fileName: "2023-dnb-seat-matrix.pdf",
  },
];

function loadGenerated(): SeatMatrixDocument[] {
  const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "mcc-seat-matrix.generated.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SeatMatrixDocument[];
  } catch {
    return [];
  }
}

export function getSeatMatrixManifest(): SeatMatrixDocument[] {
  const byKey = new Map<string, SeatMatrixDocument>();
  for (const doc of loadGenerated()) byKey.set(`${doc.year}-${doc.category}`, doc);
  for (const doc of MANUAL) byKey.set(`${doc.year}-${doc.category}`, doc);
  return [...byKey.values()].sort((a, b) => b.year - a.year || a.category.localeCompare(b.category));
}
