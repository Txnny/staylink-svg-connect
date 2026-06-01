// Detects stale Supabase auth tokens (signed by a rotated key) and recovers
// by clearing the persisted session and reloading the app.

const STALE_PATTERNS = [
  "invalid api key",
  "invalid_api_key",
  "invalid jwt",
  "jwt expired",
  "jws signature",
  "signature is invalid",
];

export function isStaleAuthError(err: unknown): boolean {
  const msg =
    (err as { message?: string })?.message ??
    (typeof err === "string" ? err : "");
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return STALE_PATTERNS.some((p) => lower.includes(p));
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.startsWith("supabase."))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** If the error looks like a stale-key error, wipe the session and reload. */
export function recoverIfStaleAuthError(err: unknown): boolean {
  if (!isStaleAuthError(err)) return false;
  clearSupabaseSession();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
  return true;
}
