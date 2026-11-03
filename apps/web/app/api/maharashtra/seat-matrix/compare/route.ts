import { NextResponse } from "next/server";
import {
  aggregateCompareByBranch,
  aggregateCompareByCollege,
  compareMaharashtraSeatMatrices,
  mahSeatCompareRowsToCsv,
  type CompareStatus,
} from "@/lib/maharashtra-seat-matrix-compare";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const yearA = parseInt(searchParams.get("yearA") ?? "2025", 10);
  const yearB = parseInt(searchParams.get("yearB") ?? "2026", 10);
  const matrixKey = searchParams.get("matrix") ?? "seat_matrix_r1_govt";
  const status = searchParams.get("status") as CompareStatus | null;
  const college = searchParams.get("college")?.toLowerCase();
  const branch = searchParams.get("branch")?.toLowerCase();
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  const result = compareMaharashtraSeatMatrices(yearA, yearB, matrixKey);
  if (!result) {
    return NextResponse.json(
      {
        error: `Missing seat matrix JSON for ${yearA} or ${yearB} (${matrixKey}). Run the MAH import pipeline.`,
      },
      { status: 404 }
    );
  }

  let rows = result.rows;
  if (status) rows = rows.filter((r) => r.status === status);
  if (college) rows = rows.filter((r) => r.college.toLowerCase().includes(college));
  if (branch) rows = rows.filter((r) => r.branch.toLowerCase().includes(branch));
  if (category) rows = rows.filter((r) => r.category === category);

  const total = rows.length;
  const format = searchParams.get("format");
  if (format === "csv") {
    const csv = mahSeatCompareRowsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mah-seat-matrix-${yearA}-vs-${yearB}.csv"`,
      },
    });
  }

  const view = searchParams.get("view");
  if (view === "college") {
    return NextResponse.json({
      summary: result.summary,
      colleges: aggregateCompareByCollege(rows),
      disclaimer:
        "College totals sum matched college+branch+category+quota rows from official PDF imports.",
    });
  }
  if (view === "branch") {
    return NextResponse.json({
      summary: result.summary,
      branches: aggregateCompareByBranch(rows),
      disclaimer:
        "Branch totals sum matched rows; college counts are distinct colleges with any seats in that branch.",
    });
  }

  const slice = rows.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    summary: result.summary,
    rows: slice,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    disclaimer:
      "Comparison uses official MAHACET R1 government seat matrix PDFs. Missing rows are not treated as zero seats.",
  });
}
