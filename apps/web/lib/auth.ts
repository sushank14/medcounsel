import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@medcounsel/database";
import { authConfig } from "./auth.config";
import { isEmailAllowed } from "./allowed-users";
import { verifyPassword } from "./password";
import { GUEST_EMAIL, isAuthRequired } from "./auth-access";

function normalizeLoginId(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return "";
  if (value.includes("@")) return value;
  const slug = value.replace(/[^\w.-]+/g, ".");
  return `${slug}@local.dev`;
}

async function ensureGuestUser() {
  let user = await prisma.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: GUEST_EMAIL,
        name: "Guest",
        role: "USER",
      },
    });
  }
  return user;
}

async function guestSession(): Promise<Session> {
  const user = await ensureGuestUser();
  return {
    user: {
      id: user.id,
      email: user.email ?? GUEST_EMAIL,
      name: user.name ?? "Guest",
      role: user.role,
    },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeLoginId((credentials?.email as string) ?? "");
        const password = (credentials?.password as string) ?? "";
        if (!email || !password) return null;
        if (!isEmailAllowed(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email || !isEmailAllowed(email)) return false;
        const dbUser = await prisma.user.findUnique({ where: { email } });
        return !!dbUser;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google" && user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
          });
          if (dbUser) {
            token.sub = dbUser.id;
            token.role = dbUser.role;
          }
        } else {
          token.sub = user.id ?? token.sub;
          token.role = (user as { role?: string }).role ?? "USER";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut, auth: nextAuthSession } = nextAuth;

/** Returns a signed-in session, or an auto guest session when login is disabled. */
export async function auth(): Promise<Session | null> {
  const session = await nextAuthSession();
  if (session?.user?.id) return session;
  if (isAuthRequired()) return null;
  return guestSession();
}

export const googleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);
