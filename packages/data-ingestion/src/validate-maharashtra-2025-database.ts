/**
 * Validate Maharashtra 2025 DB against pipeline reports; mark cutoffs/documents VERIFIED when checks pass.
 */
import fs from "fs";
import path from "path";
import { VerificationStatus, ParseStatus } from "@prisma/client";
import {
  prisma,
  ensureMaharashtraCounselling,
  readMah2025Config,
  writeMah2025Config,
} from "./maharashtra-db-shared.js";

const REPO = path.resolve(process.cwd(), "../..");
const PROCESSED = path.join(REPO, "data/maharashtra/2025/processed");

type Check = { name: string; ok: boolean; detail?: string };

function readJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

async function main() {
  const counselling = await ensureMaharashtraCounselling();
  const report = readJson<{
    audits: Array<{ document_key: string; extraction_status: string; rows_extracted: number }>;
  }>(path.join(PROCESSED, "validation_report.json"));

  const checks: Check[] = [];

  const docCount = await prisma.document.count({
    where: { counsellingYear: 2025 },
  });
  checks.push({
    name: "documents_registered",
    ok: docCount >= 10,
    detail: `documents=${docCount}, expected>=10`,
  });

  if (report?.audits) {
    const bad = report.audits.filter(
      (a) => a.extraction_status !== "ok" && a.extraction_status !== "missing_pdf"
    );
    checks.push({
      name: "pipeline_extractions_ok",
      ok: bad.length === 0,
      detail: bad.length ? `failed keys: ${bad.map((b) => b.document_key).join(", ")}` : "all ok",
    });

    const reg = report.audits.find((a) => a.document_key === "registered_cap3");
    checks.push({
      name: "registered_air_sml_rows",
      ok: (reg?.rows_extracted ?? 0) >= 7000,
      detail: `rows=${reg?.rows_extracted ?? 0}`,
    });
  } else {
    checks.push({ name: "pipeline_report", ok: false, detail: "validation_report.json missing" });
  }

  const cutoffByRound: Record<string, number> = {};
  for (const round of ["R1", "R2", "R3"] as const) {
    const roundRow = await prisma.counsellingRound.findUnique({
      where: {
        counsellingId_year_round: { counsellingId: counselling.id, year: 2025, round },
      },
    });
    if (!roundRow) {
      cutoffByRound[round] = 0;
      continue;
    }
    cutoffByRound[round] = await prisma.cutoff.count({
      where: { counsellingId: counselling.id, year: 2025, roundId: roundRow.id },
    });
  }

  checks.push({
    name: "cutoffs_r1",
    ok: cutoffByRound.R1 >= 800,
    detail: String(cutoffByRound.R1),
  });
  checks.push({
    name: "cutoffs_r2",
    ok: cutoffByRound.R2 >= 800,
    detail: String(cutoffByRound.R2),
  });
  checks.push({
    name: "cutoffs_r3",
    ok: cutoffByRound.R3 >= 800,
    detail: String(cutoffByRound.R3),
  });

  const seatCount = await prisma.seatMatrix.count({
    where: { year: 2025, college: { state: "Maharashtra" } },
  });
  checks.push({
    name: "seat_matrices",
    ok: seatCount >= 4000,
    detail: String(seatCount),
  });

  const airIndex = readJson<{ totalRows?: number }>(
    path.join(PROCESSED, "2025-reg-cap3-air-sml-index.json")
  );
  checks.push({
    name: "air_sml_index_file",
    ok: (airIndex?.totalRows ?? 0) >= 7000,
    detail: `totalRows=${airIndex?.totalRows ?? 0}`,
  });

  const allOk = checks.every((c) => c.ok);
  const now = new Date().toISOString();

  if (allOk) {
    await prisma.cutoff.updateMany({
      where: { counsellingId: counselling.id, year: 2025 },
      data: { verificationStatus: VerificationStatus.VERIFIED },
    });
    await prisma.document.updateMany({
      where: { counsellingYear: 2025 },
      data: { verificationStatus: VerificationStatus.VERIFIED, parseStatus: ParseStatus.COMPLETED },
    });
  } else {
    await prisma.cutoff.updateMany({
      where: { counsellingId: counselling.id, year: 2025 },
      data: { verificationStatus: VerificationStatus.NEEDS_REVIEW },
    });
  }

  const verifiedCutoffs = await prisma.cutoff.count({
    where: {
      counsellingId: counselling.id,
      year: 2025,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  await writeMah2025Config(counselling.id, {
    validatedAt: now,
    predictionReady: allOk && verifiedCutoffs > 0,
    checks,
    counts: {
      cutoffsVerified: verifiedCutoffs,
      seatMatrices: seatCount,
      documents: docCount,
      cutoffsByRound: cutoffByRound,
    },
  });

  const outPath = path.join(PROCESSED, "db_validation_report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ generated_at: now, allOk, checks, verifiedCutoffs, cutoffByRound }, null, 2),
    "utf-8"
  );

  console.log(allOk ? "✅ Maharashtra 2025 database VALIDATED" : "⚠️  Maharashtra 2025 database NEEDS REVIEW");
  for (const c of checks) {
    console.log(`   ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? `: ${c.detail}` : ""}`);
  }
  console.log(`   Verified cutoffs: ${verifiedCutoffs}`);
  console.log(`   predictionReady: ${allOk && verifiedCutoffs > 0}`);
  console.log(`   Report: ${outPath}`);

  if (!allOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
