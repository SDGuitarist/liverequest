const SESSION_KEY = "liverequest_session_id";

/**
 * Get or create an anonymous session ID.
 * Persists in localStorage so the same browser tab keeps the same identity
 * across page reloads (prevents duplicate requests).
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    // Server-side fallback — should never be used for inserts
    return "server";
  }

  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
