/**
 * Import verified Maharashtra 2025 pipeline JSON into Prisma (cutoffs, seat matrices, documents, audits).
 * Run after: python3.11 .../run_pipeline.py --skip-download
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  VerificationStatus,
  ParseStatus,
} from "@prisma/client";
import type { MahCutoffAggregate } from "./parse-maharashtra-pdf.js";
import {
  prisma,
  ensureMaharashtraCounselling,
  ensureMahRound,
  ensureMahCollege,
  ensureMahSpecialty,
  importMahCutoffBatch,
  mapMahCategory,
  docTypeForKind,
  writeMah2025Config,
} from "./maharashtra-db-shared.js";
import { slugify } from "./normalizers.js";

const REPO = path.resolve(process.cwd(), "../..");
const MAH_2025 = path.join(REPO, "data/maharashtra/2025");
const PROCESSED = path.join(MAH_2025, "processed");

function sha256File(filePath: string): string {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function readJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

const DOC_PATHS: Record<string, string> = {
  merit_r1: "merit_lists/02-pgm-merit-r1.pdf",
  merit_cap3: "merit_lists/pgm-merit-cap3.pdf",
  registered_cap3: "merit_lists/pgm-reg-cap3.pdf",
  seat_matrix_r1_govt: "seat_matrices/round_1/05-Final-PGM25-Govt-Degree.pdf",
  seat_matrix_r1_pvt: "seat_matrices/round_1/07-Final-PGM25-Pvt.pdf",
  seat_matrix_r2_original: "seat_matrices/round_2/original/PGM_R2_Seat.pdf",
  seat_matrix_r2_updated: "seat_matrices/round_2/updated/PGM_R2_Seat23Dec.pdf",
  seat_matrix_r3: "seat_matrices/round_3/PGM_R3_Seat.pdf",
  allotment_r1: "allotments/round_1/SelList_R1.pdf",
  allotment_r2: "allotments/round_2/SelList_R2.pdf",
  allotment_r3: "allotments/round_3/Revised_SelList_R3.pdf",
};

async function ensureSource(url: string, title: string) {
  const existing = await prisma.source.findFirst({ where: { url } });
  if (existing) return existing;
  return prisma.source.create({
    data: {
      authority: "MAHACET",
      title,
      url,
      dataYear: 2025,
      sourceType: "OFFICIAL",
      trustLevel: "PRIMARY",
      lastVerifiedDate: new Date(),
    },
  });
}

async function importDocuments() {
  const urls = readJson<Array<{ key: string; url: string; kind: string; round: string; version: string }>>(
    path.join(PROCESSED, "source_urls.json")
  );
  if (!urls) throw new Error("Missing source_urls.json — run Python pipeline first");

  let count = 0;
  for (const spec of urls) {
    const rel = DOC_PATHS[spec.key];
    if (!rel) continue;
    const filePath = path.join(MAH_2025, rel);
    if (!fs.existsSync(filePath)) continue;

    const source = await ensureSource(spec.url, spec.key);
    const checksum = sha256File(filePath);
    const existing = await prisma.document.findFirst({
      where: { sourceUrl: spec.url, counsellingYear: 2025 },
    });
    const data = {
      sourceId: source.id,
      fileName: path.basename(filePath),
      docType: docTypeForKind(spec.kind),
      parseStatus: ParseStatus.COMPLETED,
      sourceUrl: spec.url,
      checksumSha256: checksum,
      counsellingYear: 2025,
      counsellingRound: spec.round,
      documentVersion: spec.version,
      verificationStatus: VerificationStatus.PENDING,
      extractedData: JSON.stringify({ pipelineKey: spec.key }),
    };
    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data });
    } else {
      await prisma.document.create({ data });
    }
    count++;
  }
  return count;
}

async function importCutoffsFromClosingRanks(counsellingId: string, sourceId: string) {
  const closingPath = path.join(PROCESSED, "closing_ranks_sml_2025.json");
  const cutoffs = readJson<MahCutoffAggregate[]>(closingPath);
  if (!cutoffs?.length) throw new Error("Missing closing_ranks_sml_2025.json");

  const rounds = ["R1", "R2", "R3"] as const;
  let total = 0;
  for (const round of rounds) {
    const roundRow = await ensureMahRound(counsellingId, 2025, round);
    await prisma.cutoff.deleteMany({
      where: { counsellingId, year: 2025, roundId: roundRow.id },
    });
    const slice = cutoffs.filter((c) => c.round === round);
    total += await importMahCutoffBatch(slice, counsellingId, roundRow.id, sourceId, 2025);
  }
  return total;
}

type SeatRow = {
  college_code?: string;
  college_name_norm?: string;
  college_name_raw?: string;
  branch_name_norm?: string;
  branch_name_raw?: string;
  degree?: string;
  category?: string;
  seat_count?: number;
  quota?: string;
};

async function importSeatMatrixKey(
  key: string,
  counsellingId: string,
  round: "R1" | "R2" | "R3",
  sourceId: string,
  version?: string
) {
  const jsonPath = path.join(PROCESSED, `${key}.json`);
  const payload = readJson<{ rows: SeatRow[] }>(jsonPath);
  if (!payload?.rows?.length) return 0;

  const roundRow = await ensureMahRound(counsellingId, 2025, round);
  await prisma.seatMatrix.deleteMany({
    where: { roundId: roundRow.id, year: 2025, sourceId, college: { state: "Maharashtra" } },
  });

  let imported = 0;
  const batch: Parameters<typeof prisma.seatMatrix.create>[0]["data"][] = [];

  for (const r of payload.rows) {
    const collegeName = r.college_name_norm || r.college_name_raw || "Unknown";
    const city = collegeName.includes("Mumbai") ? "Mumbai" : "Maharashtra";
    const collegeId = await ensureMahCollege(collegeName, city, slugify(collegeName));
    const branch = r.branch_name_norm || r.branch_name_raw || "Unknown";
    const degree = r.degree ?? "MD";
    const slug = slugify(`${degree}-${branch}`);
    const specialtyId = await ensureMahSpecialty(degree, branch, slug);
    const seats = r.seat_count ?? 0;
    if (seats <= 0) continue;

    batch.push({
      collegeId,
      specialtyId,
      roundId: roundRow.id,
      year: 2025,
      category: mapMahCategory(r.category ?? "OPEN"),
      quota: r.quota === "IN_SERVICE" ? "IN_SERVICE" : "STATE",
      seats,
      sourceId,
    });
    imported++;
    if (batch.length >= 400) {
      await prisma.seatMatrix.createMany({ data: batch });
      batch.length = 0;
    }
  }
  if (batch.length) await prisma.seatMatrix.createMany({ data: batch });
  console.log(`   Seat matrix ${key} (${version ?? round}): ${imported} rows`);
  return imported;
}

async function importAudits() {
  const report = readJson<{ audits: Array<Record<string, unknown>> }>(
    path.join(PROCESSED, "validation_report.json")
  );
  if (!report?.audits) return 0;

  await prisma.mahExtractionAudit.deleteMany({
    where: { documentKey: { in: report.audits.map((a) => String(a.document_key)) } },
  });

  for (const a of report.audits) {
    await prisma.mahExtractionAudit.create({
      data: {
        documentKey: String(a.document_key),
        extractionStatus: String(a.extraction_status ?? "unknown"),
        rowsExtracted: Number(a.rows_extracted ?? 0),
        rowsVerified: Number(a.rows_verified ?? 0),
        rowsRejected: Number(a.rows_rejected ?? 0),
        errorDetails: a.error_details ? JSON.stringify(a.error_details) : null,
      },
    });
  }
  return report.audits.length;
}

async function main() {
  if (!fs.existsSync(PROCESSED)) {
    console.error("Run Python pipeline first: python3.11 packages/data-ingestion/python/maharashtra/run_pipeline.py");
    process.exit(1);
  }

  console.log("📥 Maharashtra 2025 → database import");
  const counselling = await ensureMaharashtraCounselling();
  const allotSource = await ensureSource(
    "https://statecetcell.s3.ap-south-1.amazonaws.com/PGM-25/SelList_R1.pdf",
    "Maharashtra NEET-PG 2025 Allotment Lists (R1–R3)"
  );

  const docs = await importDocuments();
  console.log(`   Documents: ${docs}`);

  const cutoffs = await importCutoffsFromClosingRanks(counselling.id, allotSource.id);
  console.log(`   Cutoffs (2025, pending verification): ${cutoffs}`);

  let seatTotal = 0;
  for (const [key, round, version] of [
    ["seat_matrix_r1_govt", "R1", "govt"],
    ["seat_matrix_r1_pvt", "R1", "pvt"],
    ["seat_matrix_r2_original", "R2", "original"],
    ["seat_matrix_r2_updated", "R2", "updated"],
    ["seat_matrix_r3", "R3", "provisional"],
  ] as const) {
    const urls = readJson<Array<{ key: string; url: string }>>(path.join(PROCESSED, "source_urls.json"));
    const spec = urls?.find((u) => u.key === key);
    const src = spec
      ? await ensureSource(spec.url, `Maharashtra 2025 seat matrix ${key}`)
      : allotSource;
    seatTotal += await importSeatMatrixKey(key, counselling.id, round, src.id, version);
  }
  console.log(`   Seat matrix rows total: ${seatTotal}`);

  const audits = await importAudits();
  console.log(`   Extraction audits: ${audits}`);

  await writeMah2025Config(counselling.id, {
    pipelineValidatedAt: readJson<{ generated_at: string }>(path.join(PROCESSED, "validation_report.json"))
      ?.generated_at,
    predictionReady: false,
    counts: {
      cutoffsVerified: 0,
      seatMatrices: seatTotal,
      documents: docs,
    },
  });

  console.log("\n✅ Import complete. Run: npm run validate:maharashtra-2025-db");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
