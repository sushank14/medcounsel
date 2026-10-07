/**
 * Sync collegeType (+ nmcId where missing) from NMC 2026–27 seat matrix JSON.
 * Run: DATABASE_URL="file:../database/prisma/prod.db" npx tsx src/sync-college-types-from-nmc.ts [--fix]
 */
import fs from "fs";
import path from "path";
import { PrismaClient, CollegeType } from "@prisma/client";
import { displayCollegeName } from "../../types/src/college-display.js";

const prisma = new PrismaClient();
const FIX = process.argv.includes("--fix");
const JSON_PATH = path.resolve(process.cwd(), "../../data/processed/nmc/2026-27-seat-matrix.json");

interface NmcRow {
  collegeCode: string;
  collegeName: string;
  category: string;
}

function normName(name: string) {
  return displayCollegeName(name).toUpperCase().replace(/\s+/g, " ").trim();
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error("Missing NMC JSON:", JSON_PATH);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as { rows: NmcRow[] };
  const byCode = new Map<string, CollegeType>();
  const byName = new Map<string, { code: string; category: CollegeType }>();

  for (const row of payload.rows) {
    const category = row.category as CollegeType;
    byCode.set(row.collegeCode, category);
    for (const key of [normName(row.collegeName), normName(row.collegeName.split(",")[0] ?? "")]) {
      if (key && !byName.has(key)) byName.set(key, { code: row.collegeCode, category });
    }
  }

  const colleges = await prisma.college.findMany({
    where: { dataStatus: "OFFICIAL", NOT: { slug: { startsWith: "demo-" } } },
    select: { id: true, name: true, collegeType: true, nmcId: true },
  });

  let typeUpdates = 0;
  let nmcIdUpdates = 0;

  for (const c of colleges) {
    const fromCode = c.nmcId ? byCode.get(c.nmcId) : undefined;
    const nameHit =
      byName.get(normName(c.name)) ??
      byName.get(normName(c.name.split(",")[0] ?? c.name));
    const category = fromCode ?? nameHit?.category;
    const code = nameHit?.code ?? (c.nmcId && byCode.has(c.nmcId) ? c.nmcId : undefined);

    if (!category) continue;

    const updates: { collegeType?: CollegeType; nmcId?: string } = {};
    if (category !== c.collegeType) updates.collegeType = category;
    if (code && c.nmcId !== code && !c.nmcId?.includes("/")) updates.nmcId = code;

    if (Object.keys(updates).length === 0) continue;

    if (updates.collegeType) typeUpdates++;
    if (updates.nmcId) nmcIdUpdates++;

    if (FIX) {
      await prisma.college.update({ where: { id: c.id }, data: updates });
    } else {
      console.log(
        `${c.collegeType}→${updates.collegeType ?? c.collegeType} | ${c.name.slice(0, 65)}`
      );
    }
  }

  console.log(`\n${FIX ? "Applied" : "Would apply"}: ${typeUpdates} type updates, ${nmcIdUpdates} nmcId backfills`);
  if (!FIX) console.log("Re-run with --fix to apply.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
