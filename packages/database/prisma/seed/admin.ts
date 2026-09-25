import { PrismaClient } from "@prisma/client";
import { seedAllowedUsers, getDefaultUserEmail } from "./allowed-users";

export async function seedAdminUser(prisma: PrismaClient) {
  await seedAllowedUsers(prisma);

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: getDefaultUserEmail("ADMIN") },
  });
  const demoUser = await prisma.user.findUniqueOrThrow({
    where: { email: getDefaultUserEmail("USER") },
  });

  // Profiles are created by each user via /onboarding — not hardcoded here.

  return { admin, demoUser };
}
