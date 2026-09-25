import type { PrismaClient } from "@prisma/client";

const PATCHES: Array<{ table: string; column: string; ddl: string }> = [
  {
    table: "CandidateProfile",
    column: "degreePref",
    ddl: `ALTER TABLE "CandidateProfile" ADD COLUMN "degreePref" TEXT NOT NULL DEFAULT 'ALL'`,
  },
];

/** Add missing columns when prod.db predates a schema change (safe, idempotent). */
export async function ensureSchemaPatches(client: PrismaClient): Promise<void> {
  for (const patch of PATCHES) {
    const cols = await client.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("${patch.table}")`
    );
    if (!cols.some((c) => c.name === patch.column)) {
      await client.$executeRawUnsafe(patch.ddl);
      console.info(`[database] Applied schema patch: ${patch.table}.${patch.column}`);
    }
  }
}
