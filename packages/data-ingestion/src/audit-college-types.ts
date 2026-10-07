/**
 * Audit + optional fix college types against NMC 2026 seat matrix + name rules.
 * Run: DATABASE_URL="file:../database/prisma/prod.db" npx tsx src/audit-college-types.ts [--fix]
 */
import fs from "fs";
import path from "path";
import { PrismaClient, CollegeType } from "@prisma/client";
import { displayCollegeName } from "../../types/src/college-display.js";
import {
  confidentCollegeTypeRetag,
  hasPrivateOwnershipSignals,
  isDeemedUniversityMedicalCollege,
  inferCollegeTypeFromName,
  qualifiesAsGovernmentCollege,
} from "../../types/src/college-type.js";

const prisma = new PrismaClient();
const FIX = process.argv.includes("--fix");
const JSON_PATH = path.resolve(process.cwd(), "../../data/processed/nmc/2026-27-seat-matrix.json");

type NmcRow = { collegeCode: string; collegeName: string; category: string };

function loadNmcLookup() {
  const byCode = new Map<string, CollegeType>();
  const byName = new Map<string, CollegeType>();
  if (!fs.existsSync(JSON_PATH)) return { byCode, byName };

  const payload = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as { rows: NmcRow[] };
  for (const row of payload.rows) {
    const cat = row.category as CollegeType;
    byCode.set(row.collegeCode, cat);
    byName.set(displayCollegeName(row.collegeName).toUpperCase(), cat);
    byName.set(row.collegeName.trim().toUpperCase(), cat);
  }
  return { byCode, byName };
}

function nmcCategoryForCollege(
  name: string,
  nmcId: string | null,
  lookup: ReturnType<typeof loadNmcLookup>
): CollegeType | null {
  if (nmcId && lookup.byCode.has(nmcId)) return lookup.byCode.get(nmcId)!;
  const dn = displayCollegeName(name).toUpperCase();
  if (lookup.byName.has(dn)) return lookup.byName.get(dn)!;
  const base = dn.split(",")[0]?.trim();
  if (base && lookup.byName.has(base)) return lookup.byName.get(base)!;
  for (const [nmcName, cat] of lookup.byName) {
    if (nmcName.startsWith(base) || base.startsWith(nmcName.slice(0, 40))) return cat;
  }
  return null;
}

async function main() {
  const lookup = loadNmcLookup();
  const colleges = await prisma.college.findMany({
    where: { dataStatus: "OFFICIAL", NOT: { slug: { startsWith: "demo-" } } },
    select: { id: true, slug: true, name: true, collegeType: true, nmcId: true },
  });

  const changes: {
    slug: string;
    name: string;
    from: string;
    to: CollegeType;
    reason: string;
  }[] = [];

  for (const c of colleges) {
    const nmcCat = nmcCategoryForCollege(c.name, c.nmcId, lookup);
    const fromName = inferCollegeTypeFromName(c.name) as CollegeType;
    const retag = confidentCollegeTypeRetag(c.name, c.collegeType);

    let target: CollegeType | null = null;
    let reason = "";

    if (nmcCat && nmcCat !== c.collegeType) {
      target = nmcCat;
      reason = "NMC seat matrix 2026-27";
    } else if (retag && retag !== c.collegeType) {
      target = retag;
      reason = "name pattern rules";
    } else if (
      !nmcCat &&
      (c.collegeType === "GOVT" || c.collegeType === "CENTRAL") &&
      hasPrivateOwnershipSignals(c.name) &&
      !qualifiesAsGovernmentCollege(c.name, c.collegeType)
    ) {
      target = fromName !== "GOVT" ? fromName : "PRIVATE";
      reason = "private ownership signals";
    } else if (
      !nmcCat &&
      c.collegeType === "GOVT" &&
      isDeemedUniversityMedicalCollege(c.name)
    ) {
      target = "DEEMED";
      reason = "deemed university pattern";
    }

    if (target && target !== c.collegeType) {
      changes.push({
        slug: c.slug,
        name: c.name.slice(0, 80),
        from: c.collegeType,
        to: target,
        reason,
      });
      if (FIX) {
        await prisma.college.update({
          where: { id: c.id },
          data: { collegeType: target },
        });
      }
    }
  }

  const falseGovtRemaining = colleges.filter(
    (c) =>
      (c.collegeType === "GOVT" || c.collegeType === "CENTRAL") &&
      !changes.some((ch) => ch.slug === c.slug) &&
      hasPrivateOwnershipSignals(c.name) &&
      !qualifiesAsGovernmentCollege(c.name, c.collegeType)
  );

  console.log(`\n📋 College type audit (${colleges.length} official colleges)`);
  console.log(`   NMC lookup entries: ${lookup.byCode.size} codes, ${lookup.byName.size} names`);
  console.log(`   ${FIX ? "Applied" : "Suggested"} changes: ${changes.length}`);

  const byReason = new Map<string, number>();
  for (const ch of changes) byReason.set(ch.reason, (byReason.get(ch.reason) ?? 0) + 1);
  for (const [r, n] of byReason) console.log(`     · ${r}: ${n}`);

  console.log("\n   Sample changes:");
  for (const ch of changes.slice(0, 35)) {
    console.log(`     ${ch.from} → ${ch.to} [${ch.reason}]: ${ch.name}`);
  }
  if (changes.length > 35) console.log(`     … and ${changes.length - 35} more`);

  if (falseGovtRemaining.length > 0) {
    console.log(`\n   ⚠ Still suspicious GOVT/CENTRAL (manual review): ${falseGovtRemaining.length}`);
    for (const c of falseGovtRemaining.slice(0, 20)) {
      console.log(`     · ${c.name.slice(0, 75)}`);
    }
  }

  if (!FIX && changes.length > 0) {
    console.log("\n   Re-run with --fix to apply updates.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
