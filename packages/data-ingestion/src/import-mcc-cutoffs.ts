import fs from "fs";
import path from "path";
import { PrismaClient, Category, Quota, Degree, VerificationStatus } from "@prisma/client";
import { getMccManifest, type MccDocument } from "./mcc-manifest.js";
import { parseMccPdfFile, type CutoffAggregate } from "./parse-mcc-pdf.js";
import { CollegeResolver } from "./college-resolver.js";

const prisma = new PrismaClient();
const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");
const PROCESSED_DIR = path.resolve(process.cwd(), "../../data/processed/mcc");

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

const CATEGORY_MAP: Record<string, Category> = {
  GENERAL: "GENERAL",
  EWS: "EWS",
  OBC: "OBC",
  SC: "SC",
  ST: "ST",
  PWD: "PWD",
};

const QUOTA_MAP: Record<string, Quota> = {
  AIQ: "AIQ",
  STATE: "STATE",
  NRI: "NRI",
  MANAGEMENT: "MANAGEMENT",
  IQ: "IQ",
};

async function ensureCounselling() {
  return prisma.counselling.upsert({
    where: { code: "AIQ" },
    update: {},
    create: {
      code: "AIQ",
      name: "MCC All India Quota (AIQ)",
      type: "MCC",
      authority: "Medical Counselling Committee (MCC)",
      portalUrl: "https://mcc.nic.in/pg-medical-counselling/",
      rankType: "AIR",
    },
  });
}

async function ensureSource(doc: MccDocument) {
  const existing = await prisma.source.findFirst({ where: { url: doc.url } });
  if (existing) {
    return prisma.source.update({
      where: { id: existing.id },
      data: { lastVerifiedDate: new Date() },
    });
  }
  return prisma.source.create({
    data: {
      authority: "MCC",
      title: doc.title,
      url: doc.url,
      publishedDate: new Date(`${doc.year}-01-01`),
      lastVerifiedDate: new Date(),
      dataYear: doc.year,
      sourceType: "OFFICIAL",
      trustLevel: "PRIMARY",
    },
  });
}

async function ensureRound(counsellingId: string, year: number, round: string) {
  const roundType = round as "R1" | "R2" | "R3" | "STRAY" | "SPECIAL";
  return prisma.counsellingRound.upsert({
    where: { counsellingId_year_round: { counsellingId, year, round: roundType } },
    update: {},
    create: { counsellingId, year, round: roundType },
  });
}

const resolver = new CollegeResolver(prisma);
const specialtyCache = new Map<string, string>();

async function ensureSpecialty(degree: string, specialty: string, slug: string) {
  const key = slug;
  if (specialtyCache.has(key)) return specialtyCache.get(key)!;

  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) {
    specialtyCache.set(key, existing.id);
    return existing.id;
  }

  const spec = await prisma.specialty.create({
    data: {
      name: specialty.replace(/^M\.?D\.?\s*\(?/i, "").replace(/\)$/, "").trim().slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug,
      category: "CLINICAL",
    },
  });
  specialtyCache.set(key, spec.id);
  return spec.id;
}

async function importCutoffs(cutoffs: CutoffAggregate[], counsellingId: string, roundId: string, sourceId: string) {
  let imported = 0;
  const batch: Parameters<typeof prisma.cutoff.create>[0]["data"][] = [];

  for (const c of cutoffs) {
    const collegeId = await resolver.resolveFromMccInstitute(c.institute, c.instituteNorm);
    const specialtyId = await ensureSpecialty(c.degree, c.specialty, c.specialtySlug);

    await prisma.collegeSpecialty.upsert({
      where: { collegeId_specialtyId: { collegeId, specialtyId } },
      update: { totalSeats: { increment: 0 } },
      create: { collegeId, specialtyId, totalSeats: c.seats },
    });

    batch.push({
      collegeId,
      specialtyId,
      counsellingId,
      roundId,
      year: c.year,
      category: CATEGORY_MAP[c.category] ?? "GENERAL",
      quota: QUOTA_MAP[c.quota] ?? "AIQ",
      openingRank: c.openingRank,
      closingRank: c.closingRank,
      rankType: "AIR",
      seats: c.seats,
      sourceId,
      verificationStatus: VerificationStatus.VERIFIED,
    });
    imported++;

    if (batch.length >= 500) {
      await prisma.cutoff.createMany({ data: batch });
      batch.length = 0;
    }
  }

  if (batch.length) await prisma.cutoff.createMany({ data: batch });
  return imported;
}

function parseYearsArg(): number[] {
  const eqArg = process.argv.find((a) => a.startsWith("--years="));
  if (eqArg) return eqArg.split("=")[1].split(",").map(Number);

  const flagIdx = process.argv.indexOf("--years");
  if (flagIdx >= 0 && process.argv[flagIdx + 1]) {
    return process.argv[flagIdx + 1].split(",").map(Number);
  }

  return [2020, 2021, 2022, 2023, 2024, 2025];
}

async function main() {
  const years = parseYearsArg();

  const replaceDemo = !process.argv.includes("--keep-demo");

  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  console.log("🏥 Importing official MCC NEET-PG AIQ cutoffs...");
  console.log(`   Years: ${years.join(", ")}`);

  const counselling = await ensureCounselling();

  if (replaceDemo) {
    const deleted = await prisma.cutoff.deleteMany({
      where: { counsellingId: counselling.id, verificationStatus: { not: "VERIFIED" } },
    });
    console.log(`   Removed ${deleted.count} demo/unverified AIQ cutoffs`);
  }

  const docs = getMccManifest().filter((d) => years.includes(d.year));
  let totalCutoffs = 0;
  let totalAllotments = 0;

  for (const doc of docs) {
    const pdfPath = path.join(IMPORT_DIR, doc.fileName);
    if (!fs.existsSync(pdfPath)) {
      console.log(`  ⚠ Skipping ${doc.fileName} — not downloaded. Run: npm run fetch-mcc`);
      continue;
    }

    console.log(`\n📄 Processing ${doc.title} (${doc.year} ${doc.round})...`);
    const { allotments, cutoffs } = await parseMccPdfFile(pdfPath, doc.year, doc.round);
    totalAllotments += allotments.length;

    const outFile = path.join(PROCESSED_DIR, `${doc.year}-${doc.round}-cutoffs.json`);
    fs.writeFileSync(outFile, JSON.stringify(cutoffs, null, 2));

    const source = await ensureSource(doc);
    const round = await ensureRound(counselling.id, doc.year, doc.round);

    // Remove existing verified cutoffs for this year+round before re-import
    await prisma.cutoff.deleteMany({
      where: { counsellingId: counselling.id, year: doc.year, roundId: round.id },
    });

    const count = await importCutoffs(cutoffs, counselling.id, round.id, source.id);
    totalCutoffs += count;
    console.log(`   ✓ ${allotments.length} allotments → ${cutoffs.length} cutoffs imported`);
  }

  const officialColleges = await prisma.college.count({ where: { dataStatus: "OFFICIAL" } });
  const verifiedCutoffs = await prisma.cutoff.count({ where: { verificationStatus: "VERIFIED" } });

  console.log(`\n✅ Import complete`);
  console.log(`   Total allotments parsed: ${totalAllotments.toLocaleString()}`);
  console.log(`   Total cutoff records: ${totalCutoffs.toLocaleString()}`);
  console.log(`   Official colleges: ${officialColleges}`);
  console.log(`   Verified cutoffs in DB: ${verifiedCutoffs.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
