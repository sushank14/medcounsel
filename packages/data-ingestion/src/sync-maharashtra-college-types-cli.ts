import { syncMaharashtraCollegeTypesFromMatrices } from "./sync-maharashtra-college-types.js";
import { prisma } from "./maharashtra-db-shared.js";

syncMaharashtraCollegeTypesFromMatrices()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
