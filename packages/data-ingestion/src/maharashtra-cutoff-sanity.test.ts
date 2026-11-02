/**
 * Regression: FORENSIC MEDICINE must not merge into General Medicine cutoffs.
 * Run: tsx src/maharashtra-cutoff-sanity.test.ts
 */
import fs from "fs";
import path from "path";
import { aggregateMahCutoffs, type ParsedMahSelection } from "./parse-maharashtra-pdf.js";

const REPO = path.resolve(process.cwd(), "../..");
const R3 = path.join(
  REPO,
  "data/maharashtra/2025/allotments/round_3/Revised_SelList_R3.allotment.json"
);

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const forensicRow: ParsedMahSelection = {
  smlRank: 3996,
  subjectCode: "0219S",
  subject: "0219S : FORENSIC MEDICINE",
  collegeRaw: "GSMC",
  cityRaw: "MUMBAI OBC",
  seatCategory: "OBC",
  candidateCategory: "OBC",
};

const medOnly = aggregateMahCutoffs([forensicRow], 2025, "R3");
assert(medOnly.length === 1, "single forensic row → one cutoff");
assert(medOnly[0]!.subject === "Forensic Medicine", "forensic subject name");
assert(medOnly[0]!.specialtySlug === "md-forensic-medicine", "forensic slug");

if (fs.existsSync(R3)) {
  const j = JSON.parse(fs.readFileSync(R3, "utf-8")) as { selections: ParsedMahSelection[] };
  const cutoffs = aggregateMahCutoffs(j.selections, 2025, "R3");
  const grantObcMd = cutoffs.find(
    (c) =>
      c.collegeNorm === "grant-medical-college-mumbai" &&
      c.specialtySlug === "md-general-medicine" &&
      c.category === "OBC"
  );
  const grantObcForensic = cutoffs.find(
    (c) =>
      c.collegeNorm === "grant-medical-college-mumbai" &&
      c.specialtySlug === "md-forensic-medicine" &&
      c.category === "OBC"
  );
  assert(grantObcMd != null, "Grant MD Medicine OBC row exists");
  assert(grantObcMd!.closingRank === 261, `Grant MD OBC closing 261, got ${grantObcMd!.closingRank}`);
  assert(grantObcForensic?.closingRank === 3996, "Forensic OBC closing stays 3996");
  const badMerge = cutoffs.filter(
    (c) =>
      c.subject === "General Medicine" &&
      c.closingRank === 3996 &&
      c.collegeNorm === "grant-medical-college-mumbai"
  );
  assert(badMerge.length === 0, "no forensic rank on General Medicine at Grant");
}

console.log("✅ maharashtra-cutoff-sanity tests passed");
