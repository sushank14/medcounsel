/**
 * Full college data repair:
 * 1. Expand MH abbreviations & clean names
 * 2. Merge duplicate colleges (same nmcId / abbrev vs full name)
 * 3. Rebuild ALL cutoff links from processed official JSON
 *
 * Run: npm run fix-all-colleges --workspace=@medcounsel/data-ingestion
 */
import fs from "fs";
import path from "path";
import {
  PrismaClient,
  Category,
  Quota,
  Degree,
  VerificationStatus,
} from "@prisma/client";
import {
  displayCollegeName,
  displayCity,
  isGarbageCollegeName,
  resolveCollegeCity,
  needsCityRepair,
  isGarbageCity,
  isGenericCollegeName,
} from "../../types/src/college-display.js";
import { normalizeCollegeName, slugify } from "./normalizers.js";
import { MAH_COLLEGE_MAP, expandInstituteAbbrev } from "./maharashtra-colleges.js";
import { CollegeResolver } from "./college-resolver.js";
import { buildProcessedLocationIndex, type LocationHint } from "./processed-city-index.js";
import type { CutoffAggregate } from "./parse-mcc-pdf.js";

const prisma = new PrismaClient();
const PROCESSED_MCC = path.resolve(process.cwd(), "../../data/processed/mcc");
const PROCESSED_MH = path.resolve(process.cwd(), "../../data/processed/maharashtra");

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

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

async function purgeDemoColleges() {
  const demos = await prisma.college.findMany({
    where: {
      OR: [{ slug: { startsWith: "demo-" } }, { dataStatus: "DEMO" }],
    },
    select: { id: true, slug: true, name: true },
  });

  let removed = 0;
  for (const c of demos) {
    await prisma.prediction.deleteMany({ where: { collegeId: c.id } });
    await prisma.preferenceItem.deleteMany({ where: { collegeId: c.id } });
    await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
    await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
    await prisma.fee.deleteMany({ where: { collegeId: c.id } });
    await prisma.bond.deleteMany({ where: { collegeId: c.id } });
    await prisma.stipend.deleteMany({ where: { collegeId: c.id } });
    await prisma.seatMatrix.deleteMany({ where: { collegeId: c.id } });
    await prisma.college.delete({ where: { id: c.id } }).catch(() => {});
    removed++;
  }

  const demoSources = await prisma.source.deleteMany({ where: { authority: "DEMO" } });
  console.log(`  Removed ${removed} demo colleges, ${demoSources.count} demo sources`);
  return removed;
}

async function mergeColleges(primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) return;

  await prisma.cutoff.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });
  await prisma.prediction.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });
  await prisma.preferenceItem.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });
  await prisma.seatMatrix.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });

  const dupSpecs = await prisma.collegeSpecialty.findMany({ where: { collegeId: duplicateId } });
  for (const ds of dupSpecs) {
    await prisma.collegeSpecialty.upsert({
      where: { collegeId_specialtyId: { collegeId: primaryId, specialtyId: ds.specialtyId } },
      update: { totalSeats: { increment: ds.totalSeats } },
      create: { collegeId: primaryId, specialtyId: ds.specialtyId, totalSeats: ds.totalSeats },
    });
  }
  await prisma.collegeSpecialty.deleteMany({ where: { collegeId: duplicateId } });

  await prisma.fee.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });
  await prisma.bond.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });
  await prisma.stipend.updateMany({ where: { collegeId: duplicateId }, data: { collegeId: primaryId } });

  await prisma.college.delete({ where: { id: duplicateId } });
}

const VALID_STATES = new Set([
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Delhi (NCT)", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Jammu And Kashmir",
  "Jammu and Kashmir", "Chandigarh", "Puducherry",
]);

function lookupLocationHint(
  name: string,
  slug: string,
  index: Map<string, LocationHint>
): LocationHint | null {
  const keys = [
    normalizeCollegeName(name),
    normalizeCollegeName(name.split(",")[0] ?? name),
    normalizeCollegeName(slug.replace(/-/g, " ")),
  ];
  for (const key of keys) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

async function expandAndCleanNames(locationIndex: Map<string, LocationHint>) {
  let updated = 0;
  let removed = 0;

  const colleges = await prisma.college.findMany({
    select: { id: true, name: true, shortName: true, city: true, state: true, slug: true },
  });

  for (const c of colleges) {
    if (isGarbageCollegeName(c.name)) {
      await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
      await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
      await prisma.fee.deleteMany({ where: { collegeId: c.id } });
      await prisma.bond.deleteMany({ where: { collegeId: c.id } });
      await prisma.stipend.deleteMany({ where: { collegeId: c.id } });
      await prisma.college.delete({ where: { id: c.id } }).catch(() => {});
      removed++;
      continue;
    }

    let name = c.name;
    if (c.state === "Maharashtra") {
      const upper = c.name.trim().toUpperCase();
      for (const [abbrev, info] of Object.entries(MAH_COLLEGE_MAP)) {
        if (upper === abbrev || upper === abbrev.replace(/\s+/g, " ") || c.slug === slugify(abbrev)) {
          name =
            info.city !== "Maharashtra"
              ? displayCollegeName(`${info.name}, ${info.city}`)
              : displayCollegeName(info.name);
          break;
        }
      }
      if (name === c.name) {
        const expanded = expandInstituteAbbrev(c.name, c.state);
        if (expanded !== c.name.replace(/\(\d{5,7}\)\s*$/, "").trim()) {
          name = displayCollegeName(expanded);
        }
      }
    }

    let cleanName = displayCollegeName(name);
    const hint = lookupLocationHint(cleanName, c.slug, locationIndex);
    let cleanState = c.state;
    if (!VALID_STATES.has(cleanState)) {
      cleanState = hint?.state ?? cleanState;
    }
    if (!VALID_STATES.has(cleanState) && cleanState.toLowerCase().includes("maharashtra")) {
      cleanState = "Maharashtra";
    }

    let cleanCity = needsCityRepair(c.city) ? "" : displayCity(c.city);
    if (!cleanCity) {
      cleanCity =
        resolveCollegeCity(cleanName, c.slug, cleanState, hint) ??
        resolveCollegeCity(c.name, c.slug, cleanState, hint) ??
        "";
    }
    if (isGenericCollegeName(cleanName) && cleanCity) {
      cleanName = displayCollegeName(`${cleanName}, ${cleanCity}`);
    }
    const cleanShort = cleanName.slice(0, 60);

    if (
      cleanName !== c.name ||
      cleanCity !== c.city ||
      cleanShort !== c.shortName ||
      cleanState !== c.state
    ) {
      await prisma.college.update({
        where: { id: c.id },
        data: {
          name: cleanName,
          shortName: cleanShort,
          city: cleanCity || "Unknown",
          state: cleanState,
        },
      });
      updated++;
    }
  }

  console.log(`  Names: ${updated} updated, ${removed} garbage removed`);
  return { updated, removed };
}

async function mergeNumberedGenericWithCutoffs() {
  const numbered = await prisma.college.findMany({
    where: { slug: { startsWith: "government-medical-college" } },
    include: { _count: { select: { cutoffs: true } } },
  });

  let merged = 0;
  for (const c of numbered) {
    if (c._count.cutoffs === 0) continue;
    if (!/^government-medical-college(-\d+|(-and-(hospital|associated-hospital))-\d+)$/.test(c.slug)) {
      continue;
    }
    if (!isGenericCollegeName(c.name)) continue;

    const target = await prisma.college.findFirst({
      where: {
        id: { not: c.id },
        state: VALID_STATES.has(c.state) ? c.state : undefined,
        NOT: { slug: { startsWith: "demo-" } },
        city: { notIn: ["Unknown", ""] },
        name: { contains: "Government Medical" },
        OR: [
          { city: c.city !== "Unknown" && c.city ? { contains: c.city.slice(0, 10) } : undefined },
          { name: { contains: c.state.slice(0, 12) } },
        ].filter(Boolean) as object[],
      },
      orderBy: { cutoffs: { _count: "desc" } },
    });

    if (target && target.city && target.city !== "Unknown") {
      await mergeColleges(target.id, c.id);
      merged++;
    }
  }

  console.log(`  Merged ${merged} numbered generic colleges (with cutoffs)`);
  return merged;
}

async function purgeNumberedGenericColleges() {
  const rows = await prisma.college.findMany({
    include: { _count: { select: { cutoffs: true } } },
  });

  const numberedGeneric =
    /^government-medical-college(-\d+|(-and-(hospital|associated-hospital))-\d+)$/;

  let removed = 0;
  for (const c of rows) {
    if (c._count.cutoffs > 0) continue;
    if (!numberedGeneric.test(c.slug)) continue;
    if (!isGenericCollegeName(c.name)) continue;

    await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
    await prisma.fee.deleteMany({ where: { collegeId: c.id } });
    await prisma.bond.deleteMany({ where: { collegeId: c.id } });
    await prisma.stipend.deleteMany({ where: { collegeId: c.id } });
    await prisma.college.delete({ where: { id: c.id } }).catch(() => {});
    removed++;
  }

  console.log(`  Removed ${removed} empty generic duplicate colleges`);
  return removed;
}

async function mergeMaharashtraAbbrevDuplicates() {
  let merged = 0;

  for (const [abbrev, info] of Object.entries(MAH_COLLEGE_MAP)) {
    const fullName =
      info.city !== "Maharashtra" ? `${info.name}, ${info.city}` : info.name;
    const abbrevSlug = slugify(abbrev);

    const abbrevRows = await prisma.college.findMany({
      where: {
        state: "Maharashtra",
        OR: [
          { slug: abbrevSlug },
          { name: { equals: abbrev } },
          { name: { equals: abbrev.replace(/\s+/g, " ") } },
          ...(abbrev === "GGMC" ? [{ slug: "ggmc" }] : []),
        ],
      },
    });

    if (!abbrevRows.length) continue;

    const canonical = await prisma.college.findFirst({
      where: {
        state: "Maharashtra",
        OR: [
          { slug: slugify(fullName) },
          {
            AND: [
              { city: { contains: info.city.slice(0, 12) } },
              { name: { contains: info.name.slice(0, 18) } },
            ],
          },
        ],
        NOT: { id: { in: abbrevRows.map((r) => r.id) } },
      },
    });

    for (const abbrevRow of abbrevRows) {
      if (canonical) {
        await mergeColleges(canonical.id, abbrevRow.id);
        merged++;
      } else {
            await prisma.college.update({
          where: { id: abbrevRow.id },
          data: {
            name: displayCollegeName(fullName),
            shortName: displayCollegeName(fullName).slice(0, 60),
            city: info.city,
          },
        });
      }
    }
  }

  console.log(`  Merged ${merged} abbreviation duplicates`);
  return merged;
}

async function mergeByNmcId() {
  const dupes = await prisma.college.groupBy({
    by: ["nmcId"],
    where: { nmcId: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  let merged = 0;
  for (const d of dupes) {
    if (!d.nmcId) continue;
    const rows = await prisma.college.findMany({
      where: { nmcId: d.nmcId },
      include: { _count: { select: { cutoffs: true, specialties: true } } },
      orderBy: [{ cutoffs: { _count: "desc" } }, { specialties: { _count: "desc" } }],
    });
    const [primary, ...rest] = rows;
    for (const dup of rest) {
      await mergeColleges(primary.id, dup.id);
      merged++;
    }
  }

  console.log(`  Merged ${merged} nmcId duplicates`);
  return merged;
}

function isDuplicatedSlug(slug: string): boolean {
  const parts = slug.split("-");
  for (let i = Math.floor(parts.length / 2); i >= 2; i--) {
    const left = parts.slice(0, i).join("-");
    const right = parts.slice(i).join("-");
    if (left.length >= 10 && left === right) return true;
  }
  return false;
}

async function mergeDuplicatedSlugColleges() {
  const dupes = await prisma.college.findMany({
    where: { NOT: { slug: { startsWith: "demo-" } } },
    include: { _count: { select: { cutoffs: true, specialties: true } } },
  });

  let merged = 0;
  for (const row of dupes) {
    if (!isDuplicatedSlug(row.slug)) continue;

    const cityKey = displayCity(row.city).toLowerCase().slice(0, 15);
    const nameRoot = displayCollegeName(row.name).split(",")[0].trim().slice(0, 24);
    if (!cityKey || !nameRoot) continue;

    const canonical = await prisma.college.findFirst({
      where: {
        id: { not: row.id },
        NOT: { slug: { startsWith: "demo-" } },
        state: row.state,
        city: { contains: cityKey.slice(0, 10) },
        name: { contains: nameRoot.slice(0, 18) },
      },
      include: { _count: { select: { cutoffs: true } } },
      orderBy: { cutoffs: { _count: "desc" } },
    });

    if (canonical && canonical._count.cutoffs >= row._count.cutoffs) {
      await mergeColleges(canonical.id, row.id);
      merged++;
    }
  }

  console.log(`  Merged ${merged} duplicated-slug colleges`);
  return merged;
}

async function mergeChandrapurAndKnownDupes() {
  const chandrapur = await prisma.college.findMany({
    where: {
      OR: [
        { city: { contains: "Chandrapur" } },
        { name: { contains: "Chandrapur" } },
        { slug: { contains: "chandrapur" } },
      ],
    },
    include: { _count: { select: { cutoffs: true, specialties: true } } },
  });
  if (chandrapur.length < 2) return 0;

  chandrapur.sort(
    (a, b) =>
      b._count.cutoffs - a._count.cutoffs || b._count.specialties - a._count.specialties
  );
  const [primary, ...rest] = chandrapur.filter((c) => !c.slug.startsWith("demo-"));
  if (!primary) return 0;

  let merged = 0;
  for (const dup of rest) {
    if (dup.id === primary.id) continue;
    await mergeColleges(primary.id, dup.id);
    merged++;
  }
  console.log(`  Merged ${merged} Chandrapur duplicates`);
  return merged;
}

async function mergeSameCityNearDuplicates() {
  const colleges = await prisma.college.findMany({
    where: { NOT: { slug: { startsWith: "demo-" } } },
    include: { _count: { select: { cutoffs: true, specialties: true } } },
  });

  const buckets = new Map<string, typeof colleges>();
  for (const c of colleges) {
    const city = displayCity(c.city).toLowerCase();
    if (!city || city.length < 3) continue;
    const norm = normalizeCollegeName(`${c.name} ${city}`);
    const key = `${c.state}|${norm}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }

  let merged = 0;
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        b._count.cutoffs - a._count.cutoffs || b._count.specialties - a._count.specialties
    );
    const [primary, ...rest] = group;
    for (const dup of rest) {
      await mergeColleges(primary.id, dup.id);
      merged++;
    }
  }

  console.log(`  Merged ${merged} same-city near duplicates`);
  return merged;
}

async function ensureSpecialty(degree: string, specialty: string, slug: string) {
  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) return existing.id;
  return (
    await prisma.specialty.create({
      data: {
        name: specialty.replace(/^M\.?D\.?\s*\(?/i, "").trim().slice(0, 100),
        degree: DEGREE_MAP[degree] ?? "MD",
        slug,
        category: "CLINICAL",
      },
    })
  ).id;
}

async function rebuildCutoffs(resolver: CollegeResolver) {
  const deleted = await prisma.cutoff.deleteMany({});
  console.log(`  Deleted ${deleted.count} old cutoff rows`);

  resolver.clearCache();
  const aiq = await prisma.counselling.findUnique({ where: { code: "AIQ" } });
  const mh = await prisma.counselling.findUnique({ where: { code: "MAHARASHTRA" } });
  const mccSource = await prisma.source.findFirst({ where: { authority: "MCC" } });
  const mhSource = await prisma.source.findFirst({
    where: { OR: [{ authority: "MAHACET" }, { title: { contains: "Maharashtra" } }] },
  });

  let mccCount = 0;
  if (aiq && mccSource && fs.existsSync(PROCESSED_MCC)) {
    for (const file of fs.readdirSync(PROCESSED_MCC).filter((f) => f.endsWith("-cutoffs.json"))) {
      const rows = JSON.parse(
        fs.readFileSync(path.join(PROCESSED_MCC, file), "utf8")
      ) as CutoffAggregate[];
      const round = file.replace(/^\d+-(.+)\.json$/, "$1").replace("-cutoffs", "");
      const year = parseInt(file.slice(0, 4), 10);

      const roundRec = await prisma.counsellingRound.upsert({
        where: { counsellingId_year_round: { counsellingId: aiq.id, year, round: round as "R1" } },
        update: {},
        create: { counsellingId: aiq.id, year, round: round as "R1" },
      });

      const batch: Parameters<typeof prisma.cutoff.create>[0]["data"][] = [];
      for (const row of rows) {
        const collegeId = await resolver.resolveFromMccInstitute(row.institute, row.instituteNorm);
        const specialtyId = await ensureSpecialty(row.degree, row.specialty, row.specialtySlug);

        await prisma.collegeSpecialty.upsert({
          where: { collegeId_specialtyId: { collegeId, specialtyId } },
          update: {},
          create: { collegeId, specialtyId, totalSeats: row.seats ?? 0 },
        });

        batch.push({
          collegeId,
          specialtyId,
          counsellingId: aiq.id,
          roundId: roundRec.id,
          year,
          category: CATEGORY_MAP[row.category] ?? "GENERAL",
          quota: QUOTA_MAP[row.quota] ?? "AIQ",
          openingRank: row.openingRank,
          closingRank: row.closingRank,
          rankType: "AIR",
          seats: row.seats,
          sourceId: mccSource.id,
          verificationStatus: VerificationStatus.VERIFIED,
        });

        if (batch.length >= 500) {
          await prisma.cutoff.createMany({ data: batch });
          mccCount += batch.length;
          batch.length = 0;
        }
      }
      if (batch.length) {
        await prisma.cutoff.createMany({ data: batch });
        mccCount += batch.length;
      }
    }
  }

  let mhCount = 0;
  if (mh && fs.existsSync(PROCESSED_MH)) {
    for (const file of fs.readdirSync(PROCESSED_MH).filter((f) => f.endsWith(".json"))) {
      const rows = JSON.parse(fs.readFileSync(path.join(PROCESSED_MH, file), "utf8")) as Array<{
        year: number;
        round: string;
        college: string;
        collegeNorm: string;
        city: string;
        subject: string;
        specialtySlug: string;
        degree: string;
        category: string;
        openingRank?: number;
        closingRank: number;
        seats?: number;
      }>;

      for (const row of rows) {
        const collegeId = await resolver.resolveFromMaharashtra(
          row.college,
          row.city,
          row.collegeNorm
        );
        const specialtyId = await ensureSpecialty(
          row.degree,
          row.subject.replace(/^(MD|MS)\s*/i, ""),
          row.specialtySlug
        );

        const roundRec = await prisma.counsellingRound.upsert({
          where: {
            counsellingId_year_round: {
              counsellingId: mh.id,
              year: row.year,
              round: row.round as "R1",
            },
          },
          update: {},
          create: { counsellingId: mh.id, year: row.year, round: row.round as "R1" },
        });

        await prisma.collegeSpecialty.upsert({
          where: { collegeId_specialtyId: { collegeId, specialtyId } },
          update: {},
          create: { collegeId, specialtyId, totalSeats: row.seats ?? 0 },
        });

        await prisma.cutoff.create({
          data: {
            collegeId,
            specialtyId,
            counsellingId: mh.id,
            roundId: roundRec.id,
            year: row.year,
            category: CATEGORY_MAP[row.category] ?? "GENERAL",
            quota: "STATE",
            openingRank: row.openingRank,
            closingRank: row.closingRank,
            rankType: "SML",
            seats: row.seats,
            ...(mhSource ? { sourceId: mhSource.id } : {}),
            verificationStatus: VerificationStatus.VERIFIED,
          },
        });
        mhCount++;
      }
    }
  }

  console.log(`  Re-imported ${mccCount.toLocaleString()} MCC + ${mhCount.toLocaleString()} Maharashtra cutoffs`);
  return mccCount + mhCount;
}

async function printStats() {
  const [colleges, orphans, abbrev, totalCutoffs, unknownCity, badState] = await Promise.all([
    prisma.college.count(),
    prisma.college.count({
      where: {
        specialties: { some: {} },
        cutoffs: { none: {} },
      },
    }),
    prisma.college.count({
      where: {
        state: "Maharashtra",
        name: { in: Object.keys(MAH_COLLEGE_MAP) },
      },
    }),
    prisma.cutoff.count(),
    prisma.college.count({
      where: { OR: [{ city: "Unknown" }, { city: "" }] },
    }),
    prisma.college.count({
      where: {
        state: { notIn: [...VALID_STATES] },
      },
    }),
  ]);

  console.log("\n📊 After repair:");
  console.log(`   Colleges: ${colleges.toLocaleString()}`);
  console.log(`   Cutoffs: ${totalCutoffs.toLocaleString()}`);
  console.log(`   Orphans (specs but no cutoffs): ${orphans}`);
  console.log(`   Unknown/empty city left: ${unknownCity}`);
  console.log(`   Invalid state left: ${badState}`);
  console.log(`   Unexpanded MH abbrev names left: ${abbrev}`);
}

async function main() {
  console.log("🔧 Step 0 — Remove demo/placeholder colleges...");
  await purgeDemoColleges();

  console.log("🔧 Step 0b — Build city index from official JSON...");
  const locationIndex = buildProcessedLocationIndex();
  console.log(`  Indexed ${locationIndex.size.toLocaleString()} institute → city mappings`);

  console.log("🔧 Step 1/4 — Clean & expand college names...");
  await expandAndCleanNames(locationIndex);

  console.log("🔧 Step 2/4 — Merge duplicate colleges...");
  await mergeMaharashtraAbbrevDuplicates();
  await mergeByNmcId();
  await mergeDuplicatedSlugColleges();
  await mergeSameCityNearDuplicates();

  console.log("🔧 Step 3/4 — Rebuild cutoff links from official JSON...");
  const resolver = new CollegeResolver(prisma, locationIndex);
  await rebuildCutoffs(resolver);

  console.log("🔧 Step 3b — Post-import dedupe...");
  await mergeDuplicatedSlugColleges();
  await mergeSameCityNearDuplicates();
  await mergeChandrapurAndKnownDupes();

  console.log("🔧 Step 4/5 — Re-tag private DNB hospitals misclassified as GOVT...");
  const { confidentCollegeTypeRetag } = await import("../../types/src/college-type.js");
  const typeCandidates = await prisma.college.findMany({
    where: { dataStatus: "OFFICIAL", NOT: { slug: { startsWith: "demo-" } } },
    select: { id: true, name: true, collegeType: true },
  });
  let typeFixes = 0;
  for (const c of typeCandidates) {
    const inferred = confidentCollegeTypeRetag(c.name, c.collegeType);
    if (!inferred || inferred === c.collegeType) continue;
    await prisma.college.update({ where: { id: c.id }, data: { collegeType: inferred } });
    typeFixes++;
  }
  console.log(`  Retagged ${typeFixes} colleges`);

  console.log("🔧 Step 5/5 — Purge empty generic duplicates & stats...");
  await mergeNumberedGenericWithCutoffs();
  await purgeNumberedGenericColleges();
  await printStats();

  console.log("\n✅ Full college data repair complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
