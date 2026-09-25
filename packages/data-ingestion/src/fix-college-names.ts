/**
 * One-time / repeatable fix for duplicated PDF-import college names and cities.
 * Run: npm run fix-college-names --workspace=@medcounsel/data-ingestion
 */
import { PrismaClient } from "@prisma/client";
import {
  displayCollegeName,
  displayCity,
  isGarbageCollegeName,
  isGenericCollegeName,
  needsCityRepair,
  resolveCollegeCity,
} from "../../types/src/college-display.js";
import { buildProcessedLocationIndex } from "./processed-city-index.js";
import { normalizeCollegeName } from "./normalizers.js";

const prisma = new PrismaClient();

async function main() {
  const locationIndex = buildProcessedLocationIndex();
  const colleges = await prisma.college.findMany({
    select: { id: true, name: true, shortName: true, city: true, slug: true },
  });

  let updated = 0;
  let removed = 0;

  for (const c of colleges) {
    if (isGarbageCollegeName(c.name)) {
      await prisma.cutoff.deleteMany({ where: { collegeId: c.id } });
      await prisma.collegeSpecialty.deleteMany({ where: { collegeId: c.id } });
      await prisma.fee.deleteMany({ where: { collegeId: c.id } });
      await prisma.bond.deleteMany({ where: { collegeId: c.id } });
      await prisma.stipend.deleteMany({ where: { collegeId: c.id } });
      await prisma.seatMatrix.deleteMany({ where: { collegeId: c.id } });
      await prisma.college.delete({ where: { id: c.id } });
      removed++;
      console.log(`  ✗ Removed garbage: ${c.name.slice(0, 70)}`);
      continue;
    }

    let cleanName = displayCollegeName(c.name);
    const hint = locationIndex.get(normalizeCollegeName(c.name))
      ?? locationIndex.get(normalizeCollegeName(c.name.split(",")[0] ?? c.name));
    let cleanCity = needsCityRepair(c.city) ? "" : displayCity(c.city);
    if (!cleanCity) {
      cleanCity = resolveCollegeCity(cleanName, c.slug, c.state, hint) ?? "";
    }
    if (isGenericCollegeName(cleanName) && cleanCity) {
      cleanName = displayCollegeName(`${cleanName}, ${cleanCity}`);
    }
    const cleanShort = cleanName.slice(0, 60);

    if (cleanName !== c.name || cleanCity !== c.city || cleanShort !== c.shortName) {
      await prisma.college.update({
        where: { id: c.id },
        data: { name: cleanName, shortName: cleanShort, city: cleanCity },
      });
      updated++;
      if (c.name !== cleanName) {
        console.log(`  ✓ ${c.name.slice(0, 50)} → ${cleanName.slice(0, 50)}`);
      }
    }
  }

  console.log(`\n✅ Done. Updated ${updated}, removed ${removed} garbage colleges.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
