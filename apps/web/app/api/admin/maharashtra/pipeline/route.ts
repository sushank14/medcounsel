import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-access";
import { prisma } from "@medcounsel/database";
import fs from "fs";
import path from "path";

const PROCESSED = path.join(process.cwd(), "../../data/maharashtra/2025/processed");
const FALLBACK = path.join(process.cwd(), "../../data/processed/maharashtra");

function readJsonSafe(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!canAccessAdmin(user?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const validation =
    readJsonSafe(path.join(PROCESSED, "validation_report.json")) ??
    readJsonSafe(path.join(FALLBACK, "validation_report.json"));
  const downloadReport = readJsonSafe(path.join(PROCESSED, "../processed/download_report.json"));
  const sourceUrls = readJsonSafe(path.join(PROCESSED, "source_urls.json"));
  const matrixCompare = readJsonSafe(path.join(PROCESSED, "matrix_compare_r2_original_vs_updated.json"));

  const audits = await prisma.mahExtractionAudit.findMany({
    orderBy: { processedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    validation,
    downloadReport,
    sourceUrls,
    matrixCompareSummary: matrixCompare
      ? {
          changes_count: (matrixCompare as { changes_count?: number }).changes_count,
          left_rows: (matrixCompare as { left_rows?: number }).left_rows,
          right_rows: (matrixCompare as { right_rows?: number }).right_rows,
        }
      : null,
    dbAudits: audits,
  });
}
