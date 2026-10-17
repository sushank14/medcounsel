/**
 * Compare parsed 2026 MCC PDFs vs SeatMatrix rows in the database.
 * Run: DATABASE_URL=file:../database/prisma/prod.db npx tsx src/audit-mcc-seat-matrix-2026.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultProdDb = path.resolve(packageRoot, "../../database/prisma/prod.db");

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url ?? `file:${defaultProdDb}`;
  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;
  const candidates = [
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), "packages/database/prisma/prod.db"),
    path.resolve(process.cwd(), "../database/prisma/prod.db"),
    defaultProdDb,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return `file:${c}`;
  }
  return `file:${path.resolve(process.cwd(), filePath)}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";
import { parseSeatMatrixPdfFile } from "./parse-seat-matrix-pdf.js";

const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");
const prisma = new PrismaClient();
const MCC_SOURCE = { title: { contains: "MCC NEET-PG official seat matrix" } };

function quotaFrom(matrixCategory: string) {
  if (matrixCategory === "DEEMED") return "MANAGEMENT";
  if (matrixCategory === "CENTRAL") return "IQ";
  return "AIQ";
}

/** Match import pipeline: expand reservation rows + dedupe by max seats per key. */
function sumRows(
  rows: {
    instituteCode: string;
    specialtySlug: string;
    totalSeats: number;
    reservationSeats?: Record<string, number>;
  }[],
  matrixCategory: string,
  year: number
) {
  const expanded: { key: string; cat: string; seats: number }[] = [];
  for (const r of rows) {
    if (!r.specialtySlug) continue;
    const quota = quotaFrom(matrixCategory);
    if (r.reservationSeats && Object.keys(r.reservationSeats).length) {
      for (const [cat, seats] of Object.entries(r.reservationSeats)) {
        if (seats <= 0) continue;
        expanded.push({
          key: `${r.instituteCode}|${r.specialtySlug}|${year}|${cat}|${quota}`,
          cat,
          seats,
        });
      }
    } else if (r.totalSeats > 0) {
      expanded.push({
        key: `${r.instituteCode}|${r.specialtySlug}|${year}|GENERAL|${quota}`,
        cat: "GENERAL",
        seats: r.totalSeats,
      });
    }
  }

  const deduped = new Map<string, number>();
  const byCat: Record<string, number> = {};
  for (const e of expanded) {
    const prev = deduped.get(e.key);
    const seats = prev !== undefined ? Math.max(prev, e.seats) : e.seats;
    deduped.set(e.key, seats);
  }
  let totalSeats = 0;
  for (const [key, seats] of deduped) {
    totalSeats += seats;
    const cat = key.split("|")[3];
    byCat[cat] = (byCat[cat] ?? 0) + seats;
  }

  return { rows: deduped.size, seats: totalSeats, byCat, rawRows: rows.length };
}

async function main() {
  console.log("🔍 MCC 2026 seat matrix audit\n");

  let pdfGrand = 0;
  let pdfRows = 0;

  for (const doc of getSeatMatrixManifest().filter((d) => d.year === 2026)) {
    const pdfPath = path.join(IMPORT_DIR, doc.fileName);
    const parsed = await parseSeatMatrixPdfFile(pdfPath, doc.category);
    const stats = sumRows(parsed, doc.category, doc.year);
    pdfGrand += stats.seats;
    pdfRows += stats.rows;
    console.log(`${doc.fileName} (${doc.category})`);
    console.log(
      `  PDF parse: ${stats.rawRows.toLocaleString()} raw → ${stats.rows.toLocaleString()} unique rows · ${stats.seats.toLocaleString()} seats`
    );
    console.log(`  Categories:`, stats.byCat);
  }

  const dbRows = await prisma.seatMatrix.findMany({
    where: { year: 2026, source: MCC_SOURCE },
    select: { seats: true, category: true, quota: true },
  });

  const dbByCat: Record<string, number> = {};
  let dbSeats = 0;
  for (const r of dbRows) {
    dbSeats += r.seats;
    dbByCat[r.category] = (dbByCat[r.category] ?? 0) + r.seats;
  }

  console.log("\nDatabase (MCC source, year 2026):");
  console.log(`  ${dbRows.length.toLocaleString()} rows · ${dbSeats.toLocaleString()} seats`);
  console.log(`  Categories:`, dbByCat);

  const orphans = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM SeatMatrix sm LEFT JOIN College c ON sm.collegeId = c.id WHERE sm.year = 2026 AND c.id IS NULL`
  );

  console.log(`\nOrphan rows (no college): ${orphans[0]?.n ?? 0}`);
  console.log(`PDF vs DB seat delta: ${pdfGrand - dbSeats} (${pdfGrand} parsed, ${dbSeats} in DB)`);

  const deltaPct = pdfGrand ? Math.abs(pdfGrand - dbSeats) / pdfGrand : 0;
  if (deltaPct > 0.02) {
    console.log(
      `\n⚠️  Seat totals differ by ${(deltaPct * 100).toFixed(1)}% — re-run: npm run import:mcc-seat-matrix-2026`
    );
    process.exitCode = 1;
  } else {
    console.log("\n✅ PDF and DB totals align within 2%");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
