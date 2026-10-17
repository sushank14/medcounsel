import fs from "fs";
import path from "path";
import type { SeatMatrixDocument } from "./mcc-seat-matrix-manifest.js";
import { parseSeatMatrixCsvFile } from "./parse-seat-matrix-csv.js";
import { parseSeatMatrixDnbCsvFile } from "./parse-seat-matrix-dnb-csv.js";
import { parseSeatMatrixPdfFile, type ParsedSeatMatrixRow } from "./parse-seat-matrix-pdf.js";

export async function loadSeatMatrixRows(
  doc: SeatMatrixDocument,
  importDir: string
): Promise<{ rows: ParsedSeatMatrixRow[]; source: "csv" | "pdf" }> {
  if (doc.csvFileName) {
    const csvPath = path.join(importDir, doc.csvFileName);
    if (fs.existsSync(csvPath)) {
      const rows =
        doc.category === "DNB"
          ? parseSeatMatrixDnbCsvFile(csvPath)
          : parseSeatMatrixCsvFile(csvPath, doc.category);
      return { rows, source: "csv" };
    }
  }
  const pdfPath = path.join(importDir, doc.fileName);
  return { rows: await parseSeatMatrixPdfFile(pdfPath, doc.category), source: "pdf" };
}
