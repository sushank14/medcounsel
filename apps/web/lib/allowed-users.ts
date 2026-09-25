function parseEmailFromEntry(entry: string): string {
  const trimmed = entry.trim();
  const email = trimmed.includes("|") ? trimmed.split("|")[0] : trimmed;
  return email.trim().toLowerCase();
}

/** Comma-separated allowlist from env — if set, only these emails may sign in. */
export function getAllowedUserEmails(): Set<string> | null {
  const raw = process.env.ALLOWED_USERS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map(parseEmailFromEntry)
      .filter(Boolean)
  );
}

export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedUserEmails();
  if (!allowed) return true;
  return allowed.has(email.toLowerCase());
}
