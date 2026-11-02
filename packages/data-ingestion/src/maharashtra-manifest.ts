export type MaharashtraDocKind = "SELECTION" | "MERIT" | "REGISTERED" | "SEAT_MATRIX";

export interface MaharashtraPdfDoc {
  year: number;
  round: "R1" | "R2" | "R3" | "CAP3" | "MATRIX";
  kind: MaharashtraDocKind;
  title: string;
  url: string;
  fileName: string;
  provisional?: boolean;
  /** For REGISTERED lists — label used in processed JSON filename */
  listLabel?: string;
}

/** Official MAHACET / State CET Cell NEET-PG PDFs */
const MAHARASHTRA_PDFS: MaharashtraPdfDoc[] = [
  {
    year: 2026,
    round: "R1",
    kind: "MERIT",
    provisional: true,
    title: "Maharashtra NEET-PG 2026 Common Provisional State Merit List",
    url: "https://medical2026.mahacet.org/NEET-PGM-2026/instructions-downloadFile/merit-pgm-r1.pdf",
    fileName: "2026-r1-merit-list.pdf",
  },
  {
    year: 2025,
    round: "R1",
    kind: "MERIT",
    title: "Maharashtra NEET-PG 2025 Round 1 State Merit List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/02-pgm-merit-r1.pdf",
    fileName: "2025-r1-merit-list.pdf",
  },
  {
    year: 2025,
    round: "R3",
    kind: "MERIT",
    title: "Maharashtra NEET-PG 2025 CAP Round 3 State Merit List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/pgm-merit-cap3.pdf",
    fileName: "2025-r3-merit-list.pdf",
  },
  {
    year: 2025,
    round: "CAP3",
    kind: "REGISTERED",
    listLabel: "reg-cap3",
    title: "Maharashtra NEET-PG 2025 Registered Candidates (CAP Round 3 list)",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/pgm-reg-cap3.pdf",
    fileName: "2025-reg-cap3.pdf",
  },
  {
    year: 2025,
    round: "R1",
    kind: "SELECTION",
    title: "Maharashtra NEET-PG 2025 Round 1 Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R1.pdf",
    fileName: "2025-r1-sellist.pdf",
  },
  {
    year: 2025,
    round: "R2",
    kind: "SELECTION",
    title: "Maharashtra NEET-PG 2025 Round 2 Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R2.pdf",
    fileName: "2025-r2-sellist.pdf",
  },
  {
    year: 2025,
    round: "R3",
    kind: "SELECTION",
    title: "Maharashtra NEET-PG 2025 Round 3 Revised Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/Revised_SelList_R3.pdf",
    fileName: "2025-r3-sellist.pdf",
  },
  {
    year: 2025,
    round: "MATRIX",
    kind: "SEAT_MATRIX",
    title: "Maharashtra NEET-PG 2025 Round 1 Seat Matrix (Govt/Corporation)",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/05-Final%2BPGM25-Categorywise%2BGovt%2B_%2BDegree.pdf",
    fileName: "2025-r1-seat-matrix-govt.pdf",
  },
  {
    year: 2025,
    round: "MATRIX",
    kind: "SEAT_MATRIX",
    title: "Maharashtra NEET-PG 2025 Round 1 Seat Matrix (Private/Minority)",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/07-Final%2BPGM25-Categorywise%2BPvt%2Bwith%2BPer--WEBFILE..pdf",
    fileName: "2025-r1-seat-matrix-pvt.pdf",
  },
  {
    year: 2025,
    round: "R3",
    kind: "SEAT_MATRIX",
    title: "Maharashtra NEET-PG 2025 Round 3 Seat Matrix",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/PGM_R3_Seat.pdf",
    fileName: "2025-r3-seat-matrix.pdf",
  },
];

export function getMaharashtraManifest(): MaharashtraPdfDoc[] {
  return [...MAHARASHTRA_PDFS];
}

export function getMaharashtraSelectionPdfs(): MaharashtraPdfDoc[] {
  return MAHARASHTRA_PDFS.filter((d) => d.kind === "SELECTION");
}

/** @deprecated use getMaharashtraSelectionPdfs() */
export const MAHARASHTRA_SELECTION_PDFS = getMaharashtraSelectionPdfs();
