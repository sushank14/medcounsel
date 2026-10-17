/**
 * Per-institute MCC 2026 audit: parsed PDF vs DB (by MCC institute code).
 * Run: npm run audit:mcc-seat-matrix-by-college (from repo root)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";
import { loadSeatMatrixRows } from "./load-seat-matrix-rows.js";
import type { ParsedSeatMatrixRow } from "./parse-seat-matrix-pdf.js";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultProdDb = path.resolve(packageRoot, "../../database/prisma/prod.db");

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url ?? `file:${defaultProdDb}`;
  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;
  for (const c of [
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), "packages/database/prisma/prod.db"),
    path.resolve(process.cwd(), "../database/prisma/prod.db"),
    defaultProdDb,
  ]) {
    if (fs.existsSync(c)) return `file:${c}`;
  }
  return `file:${path.resolve(process.cwd(), filePath)}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();
const prisma = new PrismaClient();
const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");
const MCC_SOURCE = { title: { contains: "MCC NEET-PG official seat matrix" } };
const YEAR = 2026;

function quotaFrom(matrixCategory: string) {
  if (matrixCategory === "DEEMED") return "MANAGEMENT";
  if (matrixCategory === "CENTRAL") return "IQ";
  return "AIQ";
}

type Key = string;

function expandPdfRows(
  rows: ParsedSeatMatrixRow[],
  matrixCategory: string,
  year: number
): Map<Key, { seats: number; institute: string; code: string }> {
  const map = new Map<Key, { seats: number; institute: string; code: string }>();
  const quota = quotaFrom(matrixCategory);

  for (const r of rows) {
    if (!r.specialtySlug || !r.instituteCode) continue;
    const base = { institute: r.institute, code: r.instituteCode };

    const push = (cat: string, seats: number) => {
      if (seats <= 0) return;
      const key = `${r.instituteCode}|${r.specialtySlug}|${year}|${cat}|${quota}`;
      const prev = map.get(key);
      if (!prev || seats > prev.seats) map.set(key, { seats, ...base });
    };

    if (r.reservationSeats && Object.keys(r.reservationSeats).length) {
      for (const [cat, seats] of Object.entries(r.reservationSeats)) {
        push(cat, seats);
      }
    } else if (r.totalSeats > 0) {
      push("GENERAL", r.totalSeats);
    }
  }
  return map;
}

async function loadDbByCode(): Promise<
  Map<Key, { seats: number; collegeName: string; nmcId: string | null }>
> {
  const rows = await prisma.seatMatrix.findMany({
    where: { year: YEAR, source: MCC_SOURCE },
    include: {
      college: { select: { name: true, nmcId: true } },
      specialty: { select: { slug: true } },
    },
  });

  const map = new Map<Key, { seats: number; collegeName: string; nmcId: string | null }>();
  for (const r of rows) {
    const code = r.college.nmcId ?? "?";
    const key = `${code}|${r.specialty.slug}|${r.year}|${r.category}|${r.quota}`;
    const prev = map.get(key);
    const seats = (prev?.seats ?? 0) + r.seats;
    map.set(key, {
      seats,
      collegeName: r.college.name,
      nmcId: r.college.nmcId,
    });
  }
  return map;
}

async function main() {
  console.log("🔍 MCC 2026 per-college seat matrix audit\n");

  const pdfAll = new Map<Key, { seats: number; institute: string; code: string }>();
  const codeNames = new Map<string, string>();

  for (const doc of getSeatMatrixManifest().filter((d) => d.year === YEAR)) {
    const { rows: parsed } = await loadSeatMatrixRows(doc, IMPORT_DIR);
    if (!parsed.length) {
      console.warn(`No rows for ${doc.fileName}`);
      continue;
    }
    const chunk = expandPdfRows(parsed, doc.category, doc.year);
    for (const [k, v] of chunk) {
      pdfAll.set(k, v);
      if (v.institute.length > (codeNames.get(v.code)?.length ?? 0)) {
        codeNames.set(v.code, v.institute);
      }
    }
  }

  const dbAll = await loadDbByCode();

  const mismatches: {
    key: Key;
    pdf: number;
    db: number;
    code: string;
    institute: string;
    collegeName: string;
  }[] = [];
  const missingInDb: typeof mismatches = [];
  const extraInDb: typeof mismatches = [];

  for (const [key, pdf] of pdfAll) {
    const db = dbAll.get(key);
    if (!db) {
      missingInDb.push({
        key,
        pdf: pdf.seats,
        db: 0,
        code: pdf.code,
        institute: pdf.institute,
        collegeName: "—",
      });
      continue;
    }
    if (db.seats !== pdf.seats) {
      mismatches.push({
        key,
        pdf: pdf.seats,
        db: db.seats,
        code: pdf.code,
        institute: pdf.institute,
        collegeName: db.collegeName,
      });
    }
  }

  for (const [key, db] of dbAll) {
    if (!pdfAll.has(key)) {
      const code = key.split("|")[0];
      extraInDb.push({
        key,
        pdf: 0,
        db: db.seats,
        code,
        institute: codeNames.get(code) ?? "?",
        collegeName: db.collegeName,
      });
    }
  }

  const wrongCodeBinding: { nmcId: string; collegeName: string; pdfName: string }[] = [];
  const colleges = await prisma.college.findMany({
    where: { nmcId: { not: null }, seatMatrices: { some: { year: YEAR, source: MCC_SOURCE } } },
    select: { name: true, nmcId: true, state: true },
  });
  for (const c of colleges) {
    const pdfName = codeNames.get(c.nmcId!);
    if (!pdfName) continue;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const pn = norm(pdfName);
    const cn = norm(c.name);
    if (pn.length >= 10 && cn.length >= 10 && !pn.includes(cn.slice(0, 12)) && !cn.includes(pn.slice(0, 12))) {
      wrongCodeBinding.push({ nmcId: c.nmcId!, collegeName: c.name, pdfName });
    }
  }

  const codesWithIssues = new Set<string>();
  for (const m of [...mismatches, ...missingInDb, ...extraInDb]) codesWithIssues.add(m.code);

  console.log(`PDF unique keys: ${pdfAll.size.toLocaleString()}`);
  console.log(`DB unique keys (by nmcId): ${dbAll.size.toLocaleString()}`);
  console.log(`Institutes with any row mismatch: ${codesWithIssues.size.toLocaleString()}`);
  console.log(`  Seat count mismatches: ${mismatches.length.toLocaleString()}`);
  console.log(`  In PDF but not DB: ${missingInDb.length.toLocaleString()}`);
  console.log(`  In DB but not PDF: ${extraInDb.length.toLocaleString()}`);
  console.log(`  Suspicious college/code name pairs: ${wrongCodeBinding.length.toLocaleString()}`);

  const byCodePdfSeats = new Map<string, number>();
  const byCodeDbSeats = new Map<string, number>();
  for (const [key, v] of pdfAll) {
    const code = key.split("|")[0];
    byCodePdfSeats.set(code, (byCodePdfSeats.get(code) ?? 0) + v.seats);
  }
  for (const [key, v] of dbAll) {
    const code = key.split("|")[0];
    byCodeDbSeats.set(code, (byCodeDbSeats.get(code) ?? 0) + v.seats);
  }

  const codeDeltas: { code: string; institute: string; pdf: number; db: number; delta: number }[] = [];
  const allCodes = new Set([...byCodePdfSeats.keys(), ...byCodeDbSeats.keys()]);
  for (const code of allCodes) {
    const pdf = byCodePdfSeats.get(code) ?? 0;
    const db = byCodeDbSeats.get(code) ?? 0;
    if (pdf !== db) {
      codeDeltas.push({
        code,
        institute: codeNames.get(code) ?? "?",
        pdf,
        db,
        delta: db - pdf,
      });
    }
  }
  codeDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log(`\nInstitutes with total seat delta (top 25):`);
  for (const row of codeDeltas.slice(0, 25)) {
    console.log(
      `  ${row.code} | Δ ${row.delta >= 0 ? "+" : ""}${row.delta} (PDF ${row.pdf}, DB ${row.db}) | ${row.institute.slice(0, 70)}`
    );
  }

  if (wrongCodeBinding.length) {
    console.log(`\nSuspicious MCC code ↔ college name (top 20):`);
    for (const w of wrongCodeBinding.slice(0, 20)) {
      console.log(`  ${w.nmcId} DB="${w.collegeName.slice(0, 50)}" PDF="${w.pdfName.slice(0, 50)}"`);
    }
  }

  const reportPath = path.resolve(process.cwd(), "../../data/processed/mcc/2026-seat-matrix-audit.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          pdfKeys: pdfAll.size,
          dbKeys: dbAll.size,
          institutesWithIssues: codesWithIssues.size,
          mismatches: mismatches.length,
          missingInDb: missingInDb.length,
          extraInDb: extraInDb.length,
          wrongCodeBinding: wrongCodeBinding.length,
        },
        codeDeltas,
        mismatches: mismatches.slice(0, 500),
        missingInDb: missingInDb.slice(0, 500),
        extraInDb: extraInDb.slice(0, 500),
        wrongCodeBinding,
      },
      null,
      2
    )
  );
  console.log(`\nFull report: ${reportPath}`);

  const ok =
    mismatches.length === 0 &&
    missingInDb.length === 0 &&
    extraInDb.length === 0 &&
    wrongCodeBinding.length === 0;
  if (!ok) process.exitCode = 1;
  else console.log("\n✅ All institutes match PDF row-by-row");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
