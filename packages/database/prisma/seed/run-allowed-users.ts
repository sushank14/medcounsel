import { PrismaClient } from "@prisma/client";
import { seedAllowedUsers } from "./allowed-users";

async function main() {
  const prisma = new PrismaClient();
  await seedAllowedUsers(prisma);
  await prisma.$disconnect();
}

main().catch(console.error);
