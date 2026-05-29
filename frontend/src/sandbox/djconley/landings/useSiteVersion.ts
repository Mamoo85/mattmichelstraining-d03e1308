// Persists which landing-page version is "live" for the DJ Conley site.
// localStorage-only (per-browser) — matches the sandbox's offline-first pattern.
// The chosen id drives the public index route; full server persistence is a
// post-trial step (needs the primary Supabase tenant config).

const KEY = "dj_site_version";
export const DEFAULT_VERSION = "classic";

export function getSiteVersion(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

export function setSiteVersion(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
