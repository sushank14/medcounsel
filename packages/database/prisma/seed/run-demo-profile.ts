import { PrismaClient } from "@prisma/client";
import { getDefaultUserEmail } from "./allowed-users";
import { seedDemoProfile } from "./demo-profile";

async function main() {
  const prisma = new PrismaClient();
  const email = getDefaultUserEmail("USER");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log("User not found — run allowed-users seed first");
    return;
  }
  await seedDemoProfile(prisma, user.id);
  console.log(`Candidate profile ready for ${user.name} <${email}>`);
  await prisma.$disconnect();
}

main().catch(console.error);
