import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { ensureSchemaPatches } from "./ensure-schema";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  schemaReady?: Promise<void>;
};

/** Resolve SQLite file path — Next.js on Render runs with cwd apps/web, not repo root. */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url;

  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;

  const candidates = [
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), "../..", filePath),
    path.resolve(process.cwd(), "../../..", filePath),
    path.resolve("/opt/render/project/src", filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return `file:${candidate}`;
    }
  }

  return url;
}

const databaseUrl = resolveDatabaseUrl();

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

function schemaReady(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = ensureSchemaPatches(basePrisma).catch((err) => {
      globalForPrisma.schemaReady = undefined;
      throw err;
    });
  }
  return globalForPrisma.schemaReady;
}

/** Prisma client — auto-applies missing-column patches before the first query. */
export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      await schemaReady();
      return query(args);
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export * from "@prisma/client";
export { hashPassword, verifyPassword } from "./password";
