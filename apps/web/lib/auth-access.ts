/** When false (default), the app runs without login; a guest user is used for DB-backed features. */
export function isAuthRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true" || process.env.AUTH_REQUIRED === "1";
}

/**
 * Admin access: always requires ADMIN role in production.
 * Local dev may set ADMIN_DEV_OPEN=true to open admin without login (never use in production).
 */
export function canAccessAdmin(role: string | undefined): boolean {
  if (role === "ADMIN") return true;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ADMIN_DEV_OPEN === "true" || process.env.ADMIN_DEV_OPEN === "1";
}

export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export const GUEST_EMAIL = process.env.GUEST_EMAIL ?? "guest@medcounsel.local";
