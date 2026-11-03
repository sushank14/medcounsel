/**
 * Import Maharashtra 2026 R1 govt seat matrix JSON into Prisma (year=2026, does not touch 2025).
 */
import fs from "fs";
import path from "path";
import {
  prisma,
  ensureMaharashtraCounselling,
  ensureMahRound,
  ensureMahCollege,
  ensureMahSpecialty,
  mapMahCategory,
} from "./maharashtra-db-shared.js";
import { slugify } from "./normalizers.js";

const REPO = path.resolve(process.cwd(), "../..");
const JSON_PATH = path.join(REPO, "data/maharashtra/2026/processed/seat_matrix_r1_govt.json");
const SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1Jl2v_UhUQxJNT2WuHQqs20cLDr8pMV1Ihe8IqDZaTJo/edit";
const SOURCE_TITLE = "MAHACET NEET-PG 2026 govt seat matrix (official Google Sheet)";

type SeatRow = {
  college_name_norm?: string;
  college_name_raw?: string;
  branch_name_norm?: string;
  branch_name_raw?: string;
  degree?: string;
  category?: string;
  seat_count?: number;
  quota?: string;
};

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error("Missing", JSON_PATH, "— download PDF and run extract_seat_matrix_r1.py");
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8")) as { rows: SeatRow[] };
  const counselling = await ensureMaharashtraCounselling();
  const round = await ensureMahRound(counselling.id, 2026, "R1");

  let source = await prisma.source.findFirst({ where: { url: SOURCE_URL } });
  if (!source) {
    source = await prisma.source.create({
      data: {
        authority: "MAHACET",
        title: SOURCE_TITLE,
        url: SOURCE_URL,
        dataYear: 2026,
        sourceType: "OFFICIAL",
        trustLevel: "PRIMARY",
      },
    });
  }

  await prisma.seatMatrix.deleteMany({
    where: { year: 2026, roundId: round.id, college: { state: "Maharashtra" } },
  });

  let imported = 0;
  const batch: Parameters<typeof prisma.seatMatrix.createMany>[0]["data"] = [];

  for (const r of payload.rows) {
    const seats = r.seat_count ?? 0;
    if (seats <= 0) continue;
    const collegeName = r.college_name_norm || r.college_name_raw || "Unknown";
    if (
      collegeName.length < 12 ||
      /^\d+(MD|MS)\s/i.test(collegeName) ||
      /seat position|allotment of above|muhs nashik/i.test(collegeName) ||
      !/medical college|hospital|institute|rehabilitation|aiipmr|municipal|muncipal/i.test(collegeName)
    ) {
      continue;
    }
    const city = collegeName.toUpperCase().includes("MUMBAI") ? "Mumbai" : "Maharashtra";
    const collegeId = await ensureMahCollege(collegeName, city, slugify(collegeName));
    const branch = r.branch_name_norm || r.branch_name_raw || "Unknown";
    const degree = r.degree ?? "MD";
    const specialtyId = await ensureMahSpecialty(degree, branch, slugify(`${degree}-${branch}`));

    batch.push({
      collegeId,
      specialtyId,
      roundId: round.id,
      year: 2026,
      category: mapMahCategory(r.category ?? "OPEN"),
      quota: r.quota === "IN_SERVICE" ? "IN_SERVICE" : "STATE",
      seats,
      sourceId: source.id,
    });
    imported++;
    if (batch.length >= 400) {
      await prisma.seatMatrix.createMany({ data: batch });
      batch.length = 0;
    }
  }
  if (batch.length) await prisma.seatMatrix.createMany({ data: batch });

  console.log(`✅ Imported ${imported} Maharashtra 2026 R1 govt seat matrix rows (year 2025 unchanged)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
