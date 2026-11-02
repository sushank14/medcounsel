/**
 * Import validation_report.json into MahExtractionAudit (SQLite/Postgres via Prisma).
 */
import fs from "fs";
import path from "path";
import { prisma } from "@medcounsel/database";

const REPORT_PATHS = [
  path.resolve(process.cwd(), "../../data/maharashtra/2025/processed/validation_report.json"),
  path.resolve(process.cwd(), "../../data/processed/maharashtra/validation_report.json"),
];

async function main() {
  const reportPath = REPORT_PATHS.find((p) => fs.existsSync(p));
  if (!reportPath) {
    console.error("No validation_report.json found. Run the Python pipeline first.");
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as {
    audits: Array<{
      document_key: string;
      extraction_status: string;
      rows_extracted: number;
      rows_verified: number;
      rows_rejected: number;
      error_details?: unknown;
    }>;
  };

  for (const a of report.audits) {
    await prisma.mahExtractionAudit.create({
      data: {
        documentKey: a.document_key,
        extractionStatus: a.extraction_status,
        rowsExtracted: a.rows_extracted ?? 0,
        rowsVerified: a.rows_verified ?? 0,
        rowsRejected: a.rows_rejected ?? 0,
        errorDetails: a.error_details ? JSON.stringify(a.error_details) : null,
      },
    });
  }
  console.log(`Imported ${report.audits.length} audit rows from ${reportPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
