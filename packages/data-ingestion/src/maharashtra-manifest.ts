export type MaharashtraDocKind = "SELECTION" | "MERIT";

export interface MaharashtraPdfDoc {
  year: number;
  round: "R1" | "R2" | "R3";
  kind: MaharashtraDocKind;
  title: string;
  url: string;
  fileName: string;
  provisional?: boolean;
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
];

export function getMaharashtraManifest(): MaharashtraPdfDoc[] {
  return [...MAHARASHTRA_PDFS];
}

export function getMaharashtraSelectionPdfs(): MaharashtraPdfDoc[] {
  return MAHARASHTRA_PDFS.filter((d) => d.kind === "SELECTION");
}

/** @deprecated use getMaharashtraSelectionPdfs() */
export const MAHARASHTRA_SELECTION_PDFS = getMaharashtraSelectionPdfs();
