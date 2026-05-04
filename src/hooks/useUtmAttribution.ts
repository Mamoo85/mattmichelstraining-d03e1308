import { useEffect, useMemo } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";

export interface UtmAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landed_at: string;
}

const STORAGE_KEY = "dwa-utm-attribution";

/**
 * Captures UTM params on first landing and persists them for 30 days so they
 * can be sent with checkout/trial signup. Returns the stored attribution.
 *
 * - First-touch wins: only writes if no attribution exists OR new utm_source present.
 * - Falls back to document.referrer when no utm_source.
 */
export function useUtmAttribution(): UtmAttribution | null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");

    const existingRaw = safeLocalStorage.getItem(STORAGE_KEY);
    const existing = existingRaw ? safeParse(existingRaw) : null;

    // Refresh attribution if a new utm_source is present, or if none stored
    if (!utmSource && existing) return;

    const next: UtmAttribution = {
      source: utmSource,
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      content: params.get("utm_content"),
      term: params.get("utm_term"),
      referrer: document.referrer || null,
      landed_at: new Date().toISOString(),
    };
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw) : null;
  }, []);
}

/** Read attribution without subscribing — for use in checkout handlers. */
export function readUtmAttribution(): UtmAttribution | null {
  if (typeof window === "undefined") return null;
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  return raw ? safeParse(raw) : null;
}

function safeParse(raw: string): UtmAttribution | null {
  try { return JSON.parse(raw) as UtmAttribution; } catch { return null; }
}
