/**
 * Import ALL NEET-PG participating institutes from official MCC seat matrices
 * + merge institutes discovered in MCC allotment PDFs (2020–2025).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient, CollegeType, DataStatus, Degree, Category, Quota } from "@prisma/client";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultDevDb = path.resolve(packageRoot, "../../database/prisma/dev.db");
const defaultProdDb = path.resolve(packageRoot, "../../database/prisma/prod.db");

/** Resolve SQLite path — npm may run with cwd repo root or packages/data-ingestion. */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) {
    return url ?? `file:${defaultDevDb}`;
  }

  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;

  const candidates = [
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), "packages/database/prisma/prod.db"),
    path.resolve(process.cwd(), "../database/prisma/prod.db"),
    defaultProdDb,
    defaultDevDb,
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return `file:${candidate}`;
  }

  return `file:${path.resolve(process.cwd(), filePath)}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

interface SeatMatrixEntry {
  instituteCode: string;
  specialtySlug: string;
  degree: string;
  specialty: string;
  year: number;
  matrixCategory: SeatMatrixCategory;
  seats: number;
  reservationCategory: Category;
}

function seatMatrixEntriesFromRow(
  row: {
    instituteCode: string;
    specialtySlug: string;
    degree: string;
    specialty: string;
    totalSeats: number;
    reservationSeats?: Partial<Record<string, number>>;
  },
  year: number,
  matrixCategory: SeatMatrixCategory
): SeatMatrixEntry[] {
  const base = {
    instituteCode: row.instituteCode,
    specialtySlug: row.specialtySlug,
    degree: row.degree,
    specialty: row.specialty,
    year,
    matrixCategory,
  };
  if (row.reservationSeats && Object.keys(row.reservationSeats).length > 0) {
    return (Object.entries(row.reservationSeats) as [Category, number][])
      .filter(([, seats]) => seats > 0)
      .map(([reservationCategory, seats]) => ({
        ...base,
        seats,
        reservationCategory,
      }));
  }
  if (row.totalSeats > 0) {
    return [{ ...base, seats: row.totalSeats, reservationCategory: Category.GENERAL }];
  }
  return [];
}

const seatMatrixEntries: SeatMatrixEntry[] = [];

function dedupeSeatMatrixEntries(entries: SeatMatrixEntry[]): SeatMatrixEntry[] {
  const map = new Map<string, SeatMatrixEntry>();
  for (const entry of entries) {
    const quota = quotaFromMatrixCategory(entry.matrixCategory);
    const key = `${entry.instituteCode}|${entry.specialtySlug}|${entry.year}|${entry.reservationCategory}|${quota}`;
    const prev = map.get(key);
    if (!prev || entry.seats > prev.seats) map.set(key, entry);
  }
  return [...map.values()];
}

function quotaFromMatrixCategory(category: SeatMatrixCategory): Quota {
  switch (category) {
    case "DEEMED":
      return "MANAGEMENT";
    case "CENTRAL":
      return "IQ";
    default:
      return "AIQ";
  }
}
import { getSeatMatrixManifest } from "./mcc-seat-matrix-manifest.js";
import { loadSeatMatrixRows } from "./load-seat-matrix-rows.js";
import {
  uniqueInstitutes,
  type ParsedSeatMatrixRow,
  type SeatMatrixCategory,
} from "./parse-seat-matrix-pdf.js";
import { displayCollegeName, displayCity, isGarbageCollegeName } from "../../types/src/college-display.js";
import { inferCollegeTypeFromName } from "../../types/src/college-type.js";
import { expandInstituteAbbrev } from "./maharashtra-colleges.js";
import {
  isGarbageCollegeState,
  normalizeMccSheetState,
  resolveCollegeStateFromMatrix,
} from "./mcc-state-names.js";
import { slugify, extractStateFromInstitute, normalizeCollegeName, parseCourse } from "./normalizers.js";

const prisma = new PrismaClient();
const IMPORT_DIR = path.resolve(process.cwd(), "../../data/imports/mcc");
const PROCESSED_DIR = path.resolve(process.cwd(), "../../data/processed/mcc");

interface InstituteRecord {
  instituteCode: string;
  name: string;
  instituteNorm: string;
  state: string;
  city: string;
  collegeType: CollegeType;
  source: "SEAT_MATRIX" | "ALLOTMENT";
  matrixCategory?: SeatMatrixCategory;
  programs: Map<string, { specialtySlug: string; degree: string; specialty: string; seats: number }>;
}

const GARBAGE_NAME =
  /Not Reported|Not Allotted|Upgradation|Reported -|Manageme nt|fill up fresh choices|Did not fill|No Upgradation/i;

function inferCollegeType(name: string, category?: SeatMatrixCategory): CollegeType {
  if (category === "DEEMED") return "DEEMED";
  if (category === "CENTRAL") return "CENTRAL";
  if (category === "DNB") return "PRIVATE";
  return inferCollegeTypeFromName(name) as CollegeType;
}

function cleanDisplayName(name: string): string {
  return displayCollegeName(name);
}

function isGarbage(name: string): boolean {
  return GARBAGE_NAME.test(name) || isGarbageCollegeName(name) || name.length > 180;
}

async function loadFromSeatMatrices(matrixYears?: number[]): Promise<Map<string, InstituteRecord>> {
  seatMatrixEntries.length = 0;
  const map = new Map<string, InstituteRecord>();
  const docs = getSeatMatrixManifest().filter(
    (d) => d.year >= 2023 && (!matrixYears?.length || matrixYears.includes(d.year))
  );

  for (const doc of docs) {
    const hasCsv = doc.csvFileName && fs.existsSync(path.join(IMPORT_DIR, doc.csvFileName));
    const hasPdf = fs.existsSync(path.join(IMPORT_DIR, doc.fileName));
    if (!hasCsv && !hasPdf) {
      console.log(`  ⚠ Missing ${doc.fileName} — run: npm run fetch:seat-matrix`);
      continue;
    }

    console.log(`\n📊 Parsing ${doc.title}...`);
    const { rows, source } = await loadSeatMatrixRows(doc, IMPORT_DIR);
    const institutes = uniqueInstitutes(rows);
    console.log(
      `   ${rows.length.toLocaleString()} programs · ${institutes.length.toLocaleString()} institutes (${source === "csv" ? "Google Sheet CSV" : "PDF"})`
    );

    for (const row of rows) {
      upsertInstitute(map, row, "SEAT_MATRIX", doc.category);
      if (row.specialtySlug && map.has(row.instituteCode)) {
        seatMatrixEntries.push(
          ...seatMatrixEntriesFromRow(row, doc.year, doc.category)
        );
      }
    }
  }

  return map;
}

function upsertInstitute(
  map: Map<string, InstituteRecord>,
  row: {
    instituteCode: string;
    institute: string;
    instituteNorm: string;
    state: string;
    program: string;
    degree: string;
    specialty: string;
    specialtySlug: string;
    totalSeats: number;
  },
  source: "SEAT_MATRIX" | "ALLOTMENT",
  matrixCategory?: SeatMatrixCategory
) {
  if (!row.instituteCode || isGarbage(row.institute)) return;

  let name = cleanDisplayName(expandInstituteAbbrev(row.institute, row.state));
  if (isGarbage(name)) return;

  const key = row.instituteCode;
  const rowState = normalizeMccSheetState(row.state);
  const extracted =
    rowState !== "Unknown" ? { state: rowState, city: "Unknown" } : extractStateFromInstitute(name);
  let city = displayCity(extracted.city !== "Unknown" ? extracted.city : name);
  const state = normalizeMccSheetState(extracted.state);

  const abbrevResolved = expandInstituteAbbrev(row.institute, state);
  if (abbrevResolved !== row.institute.replace(/\(\d{5,7}\)\s*$/, "").trim()) {
    name = cleanDisplayName(abbrevResolved);
    const fromAbbrev = expandInstituteAbbrev(row.institute, "Maharashtra");
    const cityMatch = fromAbbrev.match(/,\s*([^,]+)$/);
    if (cityMatch) city = displayCity(cityMatch[1].trim());
  }

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      instituteCode: key,
      name,
      instituteNorm: row.instituteNorm || normalizeCollegeName(name),
      state,
      city,
      collegeType: inferCollegeType(name, matrixCategory),
      source,
      matrixCategory,
      programs: new Map(),
    });
  } else if (source === "SEAT_MATRIX" && state !== "Unknown") {
    existing.state = resolveCollegeStateFromMatrix(state, existing.state, true);
  } else if (state !== "Unknown" && (existing.state === "Unknown" || isGarbageCollegeState(existing.state))) {
    existing.state = state;
  }

  const inst = map.get(key)!;
  const progKey = row.specialtySlug || parseCourse(row.program).slug;
  const prev = inst.programs.get(progKey);
  inst.programs.set(progKey, {
    specialtySlug: progKey,
    degree: row.degree,
    specialty: row.specialty,
    seats: (prev?.seats ?? 0) + (row.totalSeats || 0),
  });
}

function loadFromAllotmentJson(): Map<string, InstituteRecord> {
  const map = new Map<string, InstituteRecord>();

  if (!fs.existsSync(PROCESSED_DIR)) return map;

  for (const file of fs.readdirSync(PROCESSED_DIR).filter((f) => f.endsWith("-cutoffs.json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(PROCESSED_DIR, file), "utf8")) as Array<{
      institute: string;
      instituteNorm: string;
      degree: string;
      specialty: string;
      specialtySlug?: string;
      seats?: number;
    }>;

    for (const row of data) {
      if (isGarbage(row.institute)) continue;
      const codeMatch = row.institute.match(/\((\d{5,7})\)/);
      const code = codeMatch?.[1] ?? `X-${normalizeCollegeName(row.institute).slice(0, 40)}`;
      const { degree, specialty, slug } = parseCourse(row.specialty || row.institute);

      upsertInstitute(
        map,
        {
          instituteCode: code,
          institute: row.institute,
          instituteNorm: row.instituteNorm || normalizeCollegeName(row.institute),
          state: "Unknown",
          program: row.specialty || specialty,
          degree: row.degree || degree,
          specialty,
          specialtySlug: row.specialtySlug || slug,
          totalSeats: row.seats ?? 0,
        },
        "ALLOTMENT"
      );
    }
  }

  return map;
}

function mergeMaps(primary: Map<string, InstituteRecord>, secondary: Map<string, InstituteRecord>) {
  for (const [key, rec] of secondary) {
    if (!primary.has(key)) {
      primary.set(key, rec);
      continue;
    }
    const existing = primary.get(key)!;
    for (const [prog, val] of rec.programs) {
      const prev = existing.programs.get(prog);
      existing.programs.set(prog, {
        ...val,
        seats: (prev?.seats ?? 0) + val.seats,
      });
    }
  }
}

const DEGREE_MAP: Record<string, Degree> = {
  MD: "MD",
  MS: "MS",
  DNB: "DNB",
  DIPLOMA: "DIPLOMA",
};

const specialtyCache = new Map<string, string>();

async function getSpecialtyId(slug: string): Promise<string | null> {
  if (specialtyCache.has(slug)) return specialtyCache.get(slug)!;
  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) {
    specialtyCache.set(slug, existing.id);
    return existing.id;
  }
  return null;
}

async function ensureSpecialty(degree: string, specialty: string, slug: string) {
  if (specialtyCache.has(slug)) {
    return { id: specialtyCache.get(slug)! };
  }

  const existing = await prisma.specialty.findUnique({ where: { slug } });
  if (existing) {
    specialtyCache.set(slug, existing.id);
    return existing;
  }

  const created = await prisma.specialty.create({
    data: {
      name: specialty.replace(/^M\.?D\.?\s*\(?/i, "").replace(/\)$/, "").trim().slice(0, 100),
      degree: DEGREE_MAP[degree] ?? "MD",
      slug,
      category: "CLINICAL",
    },
  });
  specialtyCache.set(slug, created.id);
  return created;
}

async function removeCollegeRecord(collegeId: string) {
  await prisma.prediction.deleteMany({ where: { collegeId } });
  await prisma.preferenceItem.deleteMany({ where: { collegeId } });
  await prisma.fee.deleteMany({ where: { collegeId } });
  await prisma.bond.deleteMany({ where: { collegeId } });
  await prisma.stipend.deleteMany({ where: { collegeId } });
  await prisma.cutoff.deleteMany({ where: { collegeId } });
  await prisma.seatMatrix.deleteMany({ where: { collegeId } });
  await prisma.collegeSpecialty.deleteMany({ where: { collegeId } });
  await prisma.college.delete({ where: { id: collegeId } });
}

function instituteNamesCompatible(a: string, b: string): boolean {
  const na = normalizeCollegeName(a);
  const nb = normalizeCollegeName(b);
  if (na === nb) return true;
  const short = na.length < nb.length ? na : nb;
  const long = na.length < nb.length ? nb : na;
  return long.includes(short) && short.length >= 12;
}

async function ensureCollege(rec: InstituteRecord): Promise<{ id: string; isNew: boolean }> {
  const slugBase = slugify(rec.name.split(",")[0]);
  let slug = slugBase;
  let n = 1;

  const byCode = await prisma.college.findFirst({ where: { nmcId: rec.instituteCode } });
  if (byCode) {
    if (!instituteNamesCompatible(byCode.name, rec.name)) {
      await prisma.college.update({
        where: { id: byCode.id },
        data: { nmcId: null },
      });
    } else {
      const namePrefix = rec.name.split(",")[0]?.trim().slice(0, 28) ?? "";
      const sibling =
        namePrefix.length >= 8
          ? await prisma.college.findFirst({
              where: {
                nmcId: null,
                id: { not: byCode.id },
                name: { startsWith: namePrefix },
                ...(rec.state !== "Unknown" ? { state: rec.state } : {}),
              },
            })
          : null;

      if (sibling && instituteNamesCompatible(sibling.name, rec.name)) {
        await prisma.collegeSpecialty.deleteMany({ where: { collegeId: byCode.id } });
        await prisma.cutoff.deleteMany({ where: { collegeId: byCode.id } });
        const matrices = await prisma.seatMatrix.findMany({ where: { collegeId: byCode.id } });
        for (const sm of matrices) {
          const dup = await prisma.seatMatrix.findFirst({
            where: {
              collegeId: sibling.id,
              specialtyId: sm.specialtyId,
              year: sm.year,
              category: sm.category,
              quota: sm.quota,
            },
          });
          if (dup) {
            await prisma.seatMatrix.delete({ where: { id: sm.id } });
          } else {
            await prisma.seatMatrix.update({
              where: { id: sm.id },
              data: { collegeId: sibling.id },
            });
          }
        }
        await removeCollegeRecord(byCode.id);
        const updated = await prisma.college.update({
          where: { id: sibling.id },
          data: {
            nmcId: rec.instituteCode,
            name: rec.name.length > sibling.name.length ? rec.name : sibling.name,
            shortName: displayCollegeName(rec.name).slice(0, 60),
            state: sibling.state === "Unknown" ? rec.state : sibling.state,
            city: sibling.city === "Unknown" ? displayCity(rec.city) : sibling.city,
            dataStatus: DataStatus.OFFICIAL,
          },
        });
        return { id: updated.id, isNew: false };
      }

      const state = resolveCollegeStateFromMatrix(
        rec.state,
        byCode.state,
        rec.source === "SEAT_MATRIX"
      );
      const city = byCode.city === "Unknown" ? displayCity(rec.city) : byCode.city;
      const patch: {
        name?: string;
        shortName?: string;
        state?: string;
        city?: string;
        dataStatus: typeof DataStatus.OFFICIAL;
      } = { dataStatus: DataStatus.OFFICIAL };
      if (rec.name.length > byCode.name.length) {
        patch.name = rec.name;
        patch.shortName = displayCollegeName(rec.name).slice(0, 60);
      }
      if (state !== byCode.state) patch.state = state;
      if (city !== byCode.city) patch.city = city;
      if (Object.keys(patch).length > 1) {
        await prisma.college.update({ where: { id: byCode.id }, data: patch });
      }
      return { id: byCode.id, isNew: false };
    }
  }

  const byExactName = await prisma.college.findFirst({ where: { name: rec.name } });
  if (byExactName) {
    if (!byExactName.nmcId || byExactName.nmcId === rec.instituteCode) {
      const updated = await prisma.college.update({
        where: { id: byExactName.id },
        data: {
          nmcId: rec.instituteCode,
          dataStatus: DataStatus.OFFICIAL,
          state: byExactName.state === "Unknown" ? rec.state : byExactName.state,
          collegeType: byExactName.collegeType === "GOVT" ? rec.collegeType : byExactName.collegeType,
        },
      });
      return { id: updated.id, isNew: false };
    }
  }

  const namePrefix = rec.name.split(",")[0]?.trim().slice(0, 32);
  const city = rec.city !== "Unknown" ? rec.city : "";
  if (namePrefix.length >= 8 && rec.state !== "Unknown") {
    const byLocal = await prisma.college.findFirst({
      where: {
        nmcId: null,
        state: rec.state,
        name: { startsWith: namePrefix },
        ...(city ? { OR: [{ city }, { name: { contains: city } }] } : {}),
      },
    });
    if (byLocal && instituteNamesCompatible(byLocal.name, rec.name)) {
      const updated = await prisma.college.update({
        where: { id: byLocal.id },
        data: {
          nmcId: rec.instituteCode,
          name: rec.name.length > byLocal.name.length ? rec.name : byLocal.name,
          shortName: displayCollegeName(rec.name).slice(0, 60),
          city: byLocal.city === "Unknown" ? displayCity(rec.city) : byLocal.city,
          dataStatus: DataStatus.OFFICIAL,
          collegeType: byLocal.collegeType === "GOVT" ? rec.collegeType : byLocal.collegeType,
        },
      });
      return { id: updated.id, isNew: false };
    }
  }

  while (await prisma.college.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${n++}`;
  }

  const created = await prisma.college.create({
    data: {
      name: rec.name,
      shortName: displayCollegeName(rec.name).slice(0, 60),
      slug,
      state: rec.state,
      city: displayCity(rec.city),
      collegeType: rec.collegeType,
      nmcId: rec.instituteCode,
      dataStatus: DataStatus.OFFICIAL,
    },
  });
  return { id: created.id, isNew: true };
}

async function cleanupGarbageColleges() {
  const bad = await prisma.college.findMany({
    where: {
      OR: [
        { name: { contains: "Not Reported" } },
        { name: { contains: "Not Allotted" } },
        { name: { contains: "Upgradation" } },
        { name: { contains: "Reported -" } },
        { name: { contains: "Manageme nt" } },
        { name: { startsWith: "&" } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`\n🧹 Removing ${bad.length} garbage college entries...`);
  for (const c of bad) {
    await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
    await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
    await prisma.seatMatrix.deleteMany({ where: { collegeId: c.id } });
    await prisma.college.delete({ where: { id: c.id } });
  }
}

async function ensureSeatMatrixSource() {
  const existing = await prisma.source.findFirst({
    where: { title: { contains: "MCC seat matrix" } },
  });
  if (existing) return existing.id;
  const created = await prisma.source.create({
    data: {
      authority: "MCC",
      title: "MCC NEET-PG official seat matrix PDFs",
      url: "https://mcc.nic.in/pg-medical-counselling/",
      publishedDate: new Date("2024-11-01"),
      lastVerifiedDate: new Date(),
      dataYear: 2026,
      sourceType: "OFFICIAL",
      trustLevel: "PRIMARY",
    },
  });
  return created.id;
}

async function upsertSeatMatrix(
  collegeId: string,
  specialtyId: string,
  entry: SeatMatrixEntry,
  sourceId: string
) {
  const quota = quotaFromMatrixCategory(entry.matrixCategory);
  const existing = await prisma.seatMatrix.findFirst({
    where: {
      collegeId,
      specialtyId,
      year: entry.year,
      category: entry.reservationCategory,
      quota,
      sourceId,
    },
  });
  if (existing) {
    await prisma.seatMatrix.update({
      where: { id: existing.id },
      data: { seats: entry.seats, sourceId },
    });
    await prisma.seatMatrix.deleteMany({
      where: {
        collegeId,
        specialtyId,
        year: entry.year,
        category: entry.reservationCategory,
        quota,
        sourceId,
        id: { not: existing.id },
      },
    });
    return;
  }
  await prisma.seatMatrix.create({
    data: {
      collegeId,
      specialtyId,
      year: entry.year,
      category: entry.reservationCategory,
      quota,
      seats: entry.seats,
      sourceId,
    },
  });
}

/** Apply MCC Google Sheet / CSV StateName column to college.state (authoritative for AIQ institutes). */
async function syncOfficialMatrixStates(matrixYears?: number[]) {
  const docs = getSeatMatrixManifest().filter(
    (d) =>
      d.category === "AIQ" &&
      (!matrixYears?.length || matrixYears.includes(d.year))
  );
  let updates = 0;
  for (const doc of docs) {
    const { rows, source } = await loadSeatMatrixRows(doc, IMPORT_DIR);
    if (source !== "csv" || !rows.length) continue;
    const byCode = new Map<string, string>();
    for (const r of rows) {
      const state = normalizeMccSheetState(r.state);
      if (state !== "Unknown") byCode.set(r.instituteCode, state);
    }
    for (const [code, state] of byCode) {
      const res = await prisma.college.updateMany({
        where: { nmcId: code },
        data: { state },
      });
      updates += res.count;
    }
  }
  if (updates > 0) {
    console.log(`\n📍 Synced StateName from official AIQ sheet for ${updates} college record(s)`);
  }
}

async function main() {
  const yearArg = process.argv.find((a) => /^\d{4}$/.test(a));
  const matrixYears = yearArg ? [parseInt(yearArg, 10)] : undefined;

  console.log(
    matrixYears
      ? `🏥 Importing MCC seat matrix ${matrixYears.join(", ")}...`
      : "🏥 Importing ALL NEET-PG participating institutes (MCC official)..."
  );

  await cleanupGarbageColleges();
  const seatMatrixSourceId = await ensureSeatMatrixSource();

  if (matrixYears?.length) {
    const removed = await prisma.seatMatrix.deleteMany({
      where: {
        year: { in: matrixYears },
        source: { title: { contains: "MCC NEET-PG official seat matrix" } },
      },
    });
    console.log(
      `   Cleared ${removed.count} prior MCC SeatMatrix rows for ${matrixYears.join(", ")}`
    );
  }

  const fromMatrix = await loadFromSeatMatrices(matrixYears);
  const fromAllotments = matrixYears ? new Map<string, InstituteRecord>() : loadFromAllotmentJson();
  if (!matrixYears) mergeMaps(fromMatrix, fromAllotments);

  const institutes = [...fromMatrix.values()].filter((r) => !isGarbage(r.name));
  console.log(`\n📋 Total unique NEET-PG institutes: ${institutes.length}`);

  let collegesCreated = 0;
  let programsLinked = 0;
  let seatMatricesWritten = 0;
  let seatMatrixSkipped = 0;

  const instituteByCode = new Map(institutes.map((r) => [r.instituteCode, r]));
  const collegeIdByCode = new Map<string, string>();

  for (const rec of institutes) {
    const college = await ensureCollege(rec);
    collegeIdByCode.set(rec.instituteCode, college.id);
    if (college.isNew) collegesCreated++;

    for (const prog of rec.programs.values()) {
      const specialty = await ensureSpecialty(prog.degree, prog.specialty, prog.specialtySlug);
      await prisma.collegeSpecialty.upsert({
        where: { collegeId_specialtyId: { collegeId: college.id, specialtyId: specialty.id } },
        update: { totalSeats: { increment: prog.seats || 0 } },
        create: {
          collegeId: college.id,
          specialtyId: specialty.id,
          totalSeats: prog.seats || 0,
        },
      });
      programsLinked++;
    }
  }

  const yearFilter = matrixYears ? new Set(matrixYears) : null;
  const matrixToWrite = dedupeSeatMatrixEntries(
    yearFilter ? seatMatrixEntries.filter((e) => yearFilter.has(e.year)) : seatMatrixEntries
  );

  for (const entry of matrixToWrite) {
    let collegeId = collegeIdByCode.get(entry.instituteCode);
    if (!collegeId) {
      const rec = instituteByCode.get(entry.instituteCode);
      if (!rec) {
        seatMatrixSkipped++;
        continue;
      }
      const college = await ensureCollege(rec);
      collegeId = college.id;
      collegeIdByCode.set(entry.instituteCode, collegeId);
    }

    const specialty = await ensureSpecialty(entry.degree, entry.specialty, entry.specialtySlug);
    await upsertSeatMatrix(collegeId, specialty.id, entry, seatMatrixSourceId);
    seatMatricesWritten++;
  }

  await syncOfficialMatrixStates(matrixYears);

  const [totalOfficial, withCode, medColleges, dnbHospitals] = await Promise.all([
    prisma.college.count({ where: { dataStatus: "OFFICIAL" } }),
    prisma.college.count({ where: { nmcId: { not: null } } }),
    prisma.college.count({
      where: { dataStatus: "OFFICIAL", name: { contains: "Medical College" } },
    }),
    prisma.college.count({
      where: { dataStatus: "OFFICIAL", OR: [{ name: { contains: "NBEMS" } }, { collegeType: "PRIVATE" }] },
    }),
  ]);

  console.log(`\n✅ NEET-PG college import complete`);
  console.log(`   Institutes processed: ${institutes.length}`);
  console.log(`   New colleges (approx): ${collegesCreated}`);
  console.log(`   Program links updated: ${programsLinked}`);
  console.log(`   Seat matrix rows written: ${seatMatricesWritten.toLocaleString()}`);
  if (seatMatrixSkipped > 0) {
    console.log(`   Seat matrix rows skipped (missing college/specialty): ${seatMatrixSkipped.toLocaleString()}`);
  }
  console.log(`   Official colleges in DB: ${totalOfficial.toLocaleString()}`);
  console.log(`   With MCC institute code: ${withCode.toLocaleString()}`);
  console.log(`   Medical colleges: ${medColleges.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
