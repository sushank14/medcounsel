/**
 * Export ranked Emergency Medicine colleges with resolved city labels for PDF generation.
 * Usage: DATABASE_URL=file:../database/prisma/prod.db tsx src/export-emergency-pdf-rows.ts india30|maharashtra
 */
import { prisma } from "@medcounsel/database";
import {
  displayCollegeName,
  displayCity,
  formatCollegeLocation,
  isGenericCollegeName,
  resolveCollegeCity,
} from "../../types/src/college-display.js";

type Mode = "india30" | "maharashtra";

function tier(rank: number): string {
  if (rank <= 4000) return "Tier 1";
  if (rank <= 7000) return "Tier 2";
  if (rank <= 10000) return "Tier 3";
  return "Tier 4";
}

async function fetchRanked(mode: Mode) {
  const mdOnly = mode === "india30";
  const stateFilter = mode === "maharashtra" ? "Maharashtra" : undefined;

  const grouped = await prisma.cutoff.groupBy({
    by: ["collegeId"],
    where: {
      year: { gte: 2024 },
      category: "GENERAL",
      counselling: { code: "AIQ" },
      specialty: mdOnly
        ? { slug: "md-emergency-medicine" }
        : {
            OR: [
              { slug: { contains: "emergency" } },
              { name: { contains: "Emergency" } },
            ],
          },
      ...(stateFilter ? { college: { state: stateFilter } } : {}),
    },
    _min: { closingRank: true },
  });

  const sorted = grouped
    .filter((g) => g._min.closingRank != null)
    .sort((a, b) => a._min.closingRank! - b._min.closingRank!);

  const limited = mode === "india30" ? sorted.slice(0, 30) : sorted;
  const collegeIds = limited.map((c) => c.collegeId);
  const colleges = await prisma.college.findMany({
    where: { id: { in: collegeIds } },
    select: { id: true, name: true, city: true, state: true, slug: true, collegeType: true },
  });
  const byId = new Map(colleges.map((c) => [c.id, c]));

  return limited
    .map((g) => {
      const c = byId.get(g.collegeId);
      const rank = g._min.closingRank!;
      if (!c) return null;

      const city =
        resolveCollegeCity(c.name, c.slug, c.state, { city: c.city }) ??
        (displayCity(c.city) || c.state);

      let name = displayCollegeName(c.name);
      const root = name.split(",")[0].trim();
      if (isGenericCollegeName(name) && !name.toLowerCase().includes(city.toLowerCase())) {
        name = `${root}, ${city}`;
      }

      const location = formatCollegeLocation(c.city, c.state, c.name, c.slug);

      return {
        name,
        city,
        state: c.state,
        collegeType: c.collegeType,
        bestAiqRank: rank,
        tier: tier(rank),
        location,
        note:
          mode === "maharashtra"
            ? `${c.collegeType}; ${location}`
            : `${location}; ${c.collegeType}`,
      };
    })
    .filter(Boolean);
}

async function main() {
  const mode = (process.argv[2] ?? "india30") as Mode;
  if (mode !== "india30" && mode !== "maharashtra") {
    console.error("Usage: export-emergency-pdf-rows.ts india30|maharashtra");
    process.exit(1);
  }
  const rows = await fetchRanked(mode);
  process.stdout.write(JSON.stringify(rows));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
