import { prisma } from "@medcounsel/database";

export async function getDataStats() {
  const [aiqCutoffs, mahCutoffs, officialColleges, sources, aiqYears, mccSources, neetPgColleges] =
    await Promise.all([
      prisma.cutoff.count({
        where: { counselling: { code: "AIQ" }, verificationStatus: "VERIFIED" },
      }),
      prisma.cutoff.count({
        where: { counselling: { code: "MAHARASHTRA" }, verificationStatus: "VERIFIED" },
      }),
      prisma.college.count({
        where: { dataStatus: "OFFICIAL", NOT: [{ slug: { startsWith: "demo-" } }] },
      }),
      prisma.source.findMany({
        where: { trustLevel: "PRIMARY" },
        orderBy: { lastVerifiedDate: "desc" },
        take: 5,
        select: { title: true, authority: true, lastVerifiedDate: true, dataYear: true },
      }),
      prisma.cutoff.groupBy({
        by: ["year"],
        where: { counselling: { code: "AIQ" }, verificationStatus: "VERIFIED" },
        orderBy: { year: "asc" },
      }),
      prisma.source.count({ where: { authority: "MCC", sourceType: "OFFICIAL" } }),
      prisma.college.count({ where: { dataStatus: "OFFICIAL", nmcId: { not: null } } }),
    ]);

  const lastImport = sources[0]?.lastVerifiedDate ?? null;
  const aiqYearRange =
    aiqYears.length > 0
      ? { min: aiqYears[0].year, max: aiqYears[aiqYears.length - 1].year, count: aiqYears.length }
      : null;

  return {
    aiqCutoffs,
    mahCutoffs,
    totalVerifiedCutoffs: aiqCutoffs + mahCutoffs,
    officialColleges,
    lastImport,
    sources,
    aiqYearRange,
    mccSources,
    neetPgColleges,
  };
}
