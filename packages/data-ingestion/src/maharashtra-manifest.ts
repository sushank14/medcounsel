export interface MaharashtraPdfDoc {
  year: number;
  round: "R1" | "R2" | "R3";
  title: string;
  url: string;
  fileName: string;
}

/** Official MAHACET / State CET Cell NEET-PG selection lists */
export const MAHARASHTRA_SELECTION_PDFS: MaharashtraPdfDoc[] = [
  {
    year: 2025,
    round: "R1",
    title: "Maharashtra NEET-PG 2025 Round 1 Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R1.pdf",
    fileName: "2025-r1-sellist.pdf",
  },
  {
    year: 2025,
    round: "R2",
    title: "Maharashtra NEET-PG 2025 Round 2 Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R2.pdf",
    fileName: "2025-r2-sellist.pdf",
  },
  {
    year: 2025,
    round: "R3",
    title: "Maharashtra NEET-PG 2025 Round 3 Revised Selection List",
    url: "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/Revised_SelList_R3.pdf",
    fileName: "2025-r3-sellist.pdf",
  },
];
