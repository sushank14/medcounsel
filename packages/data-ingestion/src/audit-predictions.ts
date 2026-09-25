import { generatePredictions } from "../../../apps/web/lib/predictions.ts";

async function main() {
  const base = {
    rank: 5000,
    rankType: "AIR" as const,
    category: "GENERAL",
    domicileState: "Maharashtra",
    counsellingPref: "BOTH" as const,
    collegePref: "GOVT_ONLY",
    budgetRange: "NO_RESTRICTION",
  };

  const govtOnly = await generatePredictions(base, { limit: 300 });
  const leaks = govtOnly.filter(
    (r) =>
      r.collegeType === "PRIVATE" ||
      r.collegeType === "DEEMED" ||
      /private|pvt\.?|unit of|apollo|max smart|medanta|fortis/i.test(r.collegeName)
  );

  console.log("GOVT_ONLY predictions:", govtOnly.length);
  console.log("Private leaks:", leaks.length);
  leaks.slice(0, 8).forEach((r) => console.log("  ✗", r.collegeName, `[${r.collegeType}]`));

  const mah = await generatePredictions(
    {
      ...base,
      rank: 800,
      rankType: "SML",
      counsellingPref: "STATE",
      category: "OBC",
    },
    { limit: 30 }
  );
  console.log("Maharashtra OBC SML:", mah.length, mah[0] ? `sample: ${mah[0].collegeName}` : "none");

  if (leaks.length > 0) process.exit(1);
  console.log("✅ Prediction filters OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
