import { PrismaClient, Specialty } from "@prisma/client";

/** Demo colleges removed — real data comes from MCC/Maharashtra import pipeline. */
export async function seedColleges(_prisma: PrismaClient, _specialties: Specialty[]) {
  console.log("  Skipped demo colleges (use import pipeline for official data)");
  return [];
}
