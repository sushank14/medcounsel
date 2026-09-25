import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../../src/password";

interface AllowedUserSpec {
  email: string;
  name: string;
  role: UserRole;
}

const DEFAULT_USERS: AllowedUserSpec[] = [
  { email: "patildiksha514@gmail.com", name: "Diksha", role: "USER" },
  { email: "sushanksakharwadeorg@gmail.com", name: "Sushank", role: "ADMIN" },
];

/** Format: email|DisplayName|ROLE — comma-separated */
function parseAllowedUsers(): AllowedUserSpec[] {
  const raw = process.env.ALLOWED_USERS?.trim();
  if (!raw) return DEFAULT_USERS;

  return raw.split(",").map((entry) => {
    const parts = entry.trim().split("|");
    if (parts.length >= 3) {
      return {
        email: parts[0].trim().toLowerCase(),
        name: parts[1].trim(),
        role: parts[2].trim().toUpperCase() === "ADMIN" ? "ADMIN" : "USER",
      };
    }
    const email = parts[0].trim().toLowerCase();
    const local = email.split("@")[0];
    return {
      email,
      name: local.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      role: email.startsWith("admin") ? "ADMIN" : "USER",
    };
  });
}

export async function seedAllowedUsers(prisma: PrismaClient) {
  const password = process.env.AUTH_DEFAULT_PASSWORD?.trim() || "Dikshu";
  const passwordHash = await hashPassword(password);
  const users = parseAllowedUsers();

  for (const spec of users) {
    await prisma.user.upsert({
      where: { email: spec.email },
      update: { passwordHash, role: spec.role, name: spec.name },
      create: {
        email: spec.email,
        name: spec.name,
        role: spec.role,
        passwordHash,
      },
    });
  }

  console.log(`  ${users.length} allowed users seeded`);
  users.forEach((u) => console.log(`    · ${u.name} <${u.email}> (${u.role})`));
}

export function getDefaultUserEmail(role: "USER" | "ADMIN"): string {
  return DEFAULT_USERS.find((u) => u.role === role)?.email ?? DEFAULT_USERS[0].email;
}
