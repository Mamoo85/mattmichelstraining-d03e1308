// Anonymous browser session id used to merge pre-checkout views into a buyer
// account once Stripe confirms an email. Persisted in localStorage.
export function getOrCreateAnonId(): string {
  const KEY = "mp_anon_session_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode, etc.) — non-persistent fallback
    return crypto.randomUUID();
  }
}
