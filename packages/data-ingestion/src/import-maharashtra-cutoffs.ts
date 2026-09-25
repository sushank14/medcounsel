import fs from "fs";
import path from "path";
import { PrismaClient, Category, Quota, Degree, DataStatus, VerificationStatus } from "@prisma/client";
import { MAHARASHTRA_SELECTION_PDFS } from "./maharashtra-manifest.js";
import { parseMaharashtraPdfFile, type MahCutoffAggregate } from "./parse-maharashtra-pdf.js";
import { slugify } from "./normalizers.js";

const prisma = new PrismaClient();
const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/maharashtra");
const PROCESSED_DIR = path.resolve(process.cwd(), "../../data/processed/maharashtra");

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

const collegeCache = new Map<string, string>();
const specialtyCache = new Map<string, string>();

async function ensureCounselling() {
  return prisma.counselling.upsert({
    where: { code: "MAHARASHTRA" },
    update: {},
    create: {
      code: "MAHARASHTRA",
      name: "Maharashtra State NEET-PG Counselling",
      type: "STATE",
      authority: "State CET Cell, Maharashtra",
      portalUrl: "https://cetcell.mahacet.org/",
      rankType: "SML",
    },
  });
}

async function ensureSource(doc: (typeof MAHARASHTRA_SELECTION_PDFS)[0]) {
  const existing = await prisma.source.findFirst({ where: { url: doc.url } });
  if (existing) {
    return prisma.source.update({
      where: { id: existing.id },
      data: { lastVerifiedDate: new Date() },
    });
  }
  return prisma.source.create({
    data: {
      authority: "MAHACET",
      title: doc.title,
      url: doc.url,
      publishedDate: new Date(`${doc.year}-12-01`),
      lastVerifiedDate: new Date(),
      dataYear: doc.year,
      sourceType: "OFFICIAL",
      trustLevel: "PRIMARY",
    },
  });
}

async function ensureRound(counsellingId: string, year: number, round: string) {
  return prisma.counsellingRound.upsert({
    where: { counsellingId_year_round: { counsellingId, year, round: round as "R1" } },
    update: {},
    create: { counsellingId, year, round: round as "R1" | "R2" | "R3" },
  });
}

async function ensureCollege(name: string, city: string, collegeNorm: string) {
  if (collegeCache.has(collegeNorm)) return collegeCache.get(collegeNorm)!;

  const slugBase = slugify(name.split(",")[0]);
  let slug = slugBase;
  let n = 1;
  while (await prisma.college.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${n++}`;
  }

  const exactName = name.split(",")[0].trim();
  const existing = await prisma.college.findFirst({
    where: {
      OR: [
        { slug: slugBase },
        { name: exactName },
        {
          AND: [
            { city: { contains: city.slice(0, 15) } },
            {
              OR: [
                { name: { contains: exactName.slice(0, 20) } },
                { slug: { contains: collegeNorm.slice(0, 20) } },
              ],
            },
          ],
        },
      ],
      state: "Maharashtra",
      dataStatus: DataStatus.OFFICIAL,
    },
  });

  if (existing) {
    collegeCache.set(collegeNorm, existing.id);
    return existing.id;
  }

  const college = await prisma.college.create({
    data: {
      name: name.slice(0, 200),
      shortName: name.split(",")[0].slice(0, 60),
      slug,
      state: "Maharashtra",
      city: city.slice(0, 60),
      collegeType: name.toLowerCase().includes("municipal") ? "GOVT" : "GOVT",
      dataStatus: DataStatus.OFFICIAL,
    },
  });
  collegeCache.set(collegeNorm, college.id);
  return college.id;
}

async function ensureSpecialty(degree: string, specialty: string, slug: string) {
  if (specialtyCache.has(slug)) return specialtyCache.get(slug)!;

  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) {
    specialtyCache.set(slug, existing.id);
    return existing.id;
  }

  const spec = await prisma.specialty.create({
    data: {
      name: specialty.slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug,
      category: "CLINICAL",
    },
  });
  specialtyCache.set(slug, spec.id);
  return spec.id;
}

async function importCutoffs(
  cutoffs: MahCutoffAggregate[],
  counsellingId: string,
  roundId: string,
  sourceId: string
) {
  let imported = 0;
  const batch: Parameters<typeof prisma.cutoff.create>[0]["data"][] = [];

  for (const c of cutoffs) {
    const collegeId = await ensureCollege(c.college, c.city, c.collegeNorm);
    const specialtyId = await ensureSpecialty(c.degree, c.subject, c.specialtySlug);

    await prisma.collegeSpecialty.upsert({
      where: { collegeId_specialtyId: { collegeId, specialtyId } },
      update: {},
      create: { collegeId, specialtyId, totalSeats: c.seats },
    });

    batch.push({
      collegeId,
      specialtyId,
      counsellingId,
      roundId,
      year: c.year,
      category: CATEGORY_MAP[c.category] ?? "GENERAL",
      quota: "STATE" as Quota,
      openingRank: c.openingRank,
      closingRank: c.closingRank,
      rankType: "SML",
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

async function main() {
  const yearsArg = process.argv.find((a) => a.startsWith("--years="));
  const years = yearsArg ? yearsArg.split("=")[1].split(",").map(Number) : [2025];

  const replaceDemo = !process.argv.includes("--keep-demo");

  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  console.log("🏥 Importing official Maharashtra NEET-PG cutoffs (SML ranks)...");
  console.log(`   Years: ${years.join(", ")}`);

  const counselling = await ensureCounselling();

  if (replaceDemo) {
    const deleted = await prisma.cutoff.deleteMany({
      where: {
        counsellingId: counselling.id,
        verificationStatus: { not: "VERIFIED" },
      },
    });
    console.log(`   Removed ${deleted.count} demo/unverified Maharashtra cutoffs`);
  }

  const docs = MAHARASHTRA_SELECTION_PDFS.filter((d) => years.includes(d.year));
  let totalCutoffs = 0;
  let totalSelections = 0;

  for (const doc of docs) {
    const pdfPath = path.join(IMPORT_DIR, doc.fileName);
    if (!fs.existsSync(pdfPath)) {
      console.log(`  ⚠ Skipping ${doc.fileName} — not downloaded. Run: npm run fetch:maharashtra`);
      continue;
    }

    console.log(`\n📄 Processing ${doc.title} (${doc.year} ${doc.round})...`);
    const { selections, cutoffs } = await parseMaharashtraPdfFile(pdfPath, doc.year, doc.round);
    totalSelections += selections.length;

    const outFile = path.join(PROCESSED_DIR, `${doc.year}-${doc.round}-cutoffs.json`);
    fs.writeFileSync(outFile, JSON.stringify(cutoffs, null, 2));

    const source = await ensureSource(doc);
    const round = await ensureRound(counselling.id, doc.year, doc.round);

    await prisma.cutoff.deleteMany({
      where: { counsellingId: counselling.id, year: doc.year, roundId: round.id },
    });

    const count = await importCutoffs(cutoffs, counselling.id, round.id, source.id);
    totalCutoffs += count;
    console.log(`   ✓ ${selections.length} selections → ${cutoffs.length} cutoffs imported`);
  }

  const mahCutoffs = await prisma.cutoff.count({
    where: { counselling: { code: "MAHARASHTRA" }, verificationStatus: "VERIFIED" },
  });

  console.log(`\n✅ Maharashtra import complete`);
  console.log(`   Total selections parsed: ${totalSelections.toLocaleString()}`);
  console.log(`   Cutoff records this run: ${totalCutoffs.toLocaleString()}`);
  console.log(`   Verified Maharashtra cutoffs in DB: ${mahCutoffs.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
