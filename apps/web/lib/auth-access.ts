/** When false (default), the app runs without login; a guest user is used for DB-backed features. */
export function isAuthRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true" || process.env.AUTH_REQUIRED === "1";
}

export function canAccessAdmin(role: string | undefined): boolean {
  if (!isAuthRequired()) return true;
  return role === "ADMIN";
}

export const GUEST_EMAIL = process.env.GUEST_EMAIL ?? "guest@medcounsel.local";
