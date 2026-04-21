/**
 * Shared postcard asset registry — SINGLE SOURCE OF TRUTH for image URLs
 * used by both the live mailer (send-postcards) and the admin preview UI
 * (AdminPostcardCampaigns + PostcardAssetDebugPanel).
 *
 * If you change a URL here, EVERYTHING stays in sync. The admin parity
 * checker (POST { check_assets: true } to send-postcards) reads this file
 * and returns these exact values so the admin can compare against what it
 * renders.
 *
 * Each asset has an ordered fallback chain. The mailer/admin pick the
 * first URL that responds 200; if all fail, we fall back to a safe
 * inline data-URI placeholder rather than stripping to ugly initials.
 */

export const POSTCARD_ASSET_VERSION = "2026-04-21-v1";

// 40x40 dark-tile data URI placeholder ("MM" badge) — used only if every
// remote photo in the chain fails. Shared with admin preview so both stay
// honest about what gets mailed when assets are down.
export const PHOTO_PLACEHOLDER_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="12" fill="#161b22"/>
      <rect x="1" y="1" width="78" height="78" rx="11" fill="none" stroke="#30363d" stroke-width="2"/>
      <text x="40" y="50" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" fill="#e6edf3" text-anchor="middle">MM</text>
    </svg>`
  );

export const BADGE_PLACEHOLDER_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="46" fill="#0d1117" stroke="#00d4ff" stroke-width="3"/>
      <text x="48" y="58" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="900" fill="#00d4ff" text-anchor="middle">DWA</text>
    </svg>`
  );

export interface PostcardAsset {
  key: "matt_photo" | "dwa_badge";
  label: string;
  /** Ordered fallback chain — first 200-OK wins. */
  candidates: string[];
  /** Final hard fallback (data URI) — guaranteed to render. */
  placeholder: string;
}

export const POSTCARD_ASSETS: Record<"matt_photo" | "dwa_badge", PostcardAsset> = {
  matt_photo: {
    key: "matt_photo",
    label: "Matt founder photo (front, lower-left card)",
    candidates: [
      "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg",
      "https://mattmichelstraining.com/images/matt-boat.jpg",
      "https://detroitwebagent.com/images/matt-boat.jpg",
    ],
    placeholder: PHOTO_PLACEHOLDER_DATA_URI,
  },
  dwa_badge: {
    key: "dwa_badge",
    label: "Detroit Web Agency circle badge (front, right column)",
    candidates: [
      "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png",
      "https://detroitwebagent.com/images/dwa-badge.png",
    ],
    placeholder: BADGE_PLACEHOLDER_DATA_URI,
  },
};

export function buildQrUrl(audienceType: string, campaignId: string, city: string): string {
  return `https://detroitwebagent.com/postcard?audience=${audienceType}&utm_campaign=${campaignId}&city=${city
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

/**
 * Resolve an asset's first working URL. Falls back to placeholder data URI
 * if every candidate fails. Used by both live send (so we never mail a
 * broken image) and the admin preview/debug panel.
 */
export async function resolveAssetUrl(
  asset: PostcardAsset,
  fetchImpl: typeof fetch = fetch
): Promise<{ url: string; usedFallbackIndex: number; usedPlaceholder: boolean; checked: Array<{ url: string; ok: boolean; status: number }> }> {
  const checked: Array<{ url: string; ok: boolean; status: number }> = [];
  for (let i = 0; i < asset.candidates.length; i++) {
    const url = asset.candidates[i];
    try {
      // HEAD first; some CDNs reject HEAD so fall back to ranged GET.
      let res = await fetchImpl(url, { method: "HEAD" });
      if (!res.ok) {
        res = await fetchImpl(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
        });
      }
      checked.push({ url, ok: res.ok, status: res.status });
      if (res.ok) {
        return { url, usedFallbackIndex: i, usedPlaceholder: false, checked };
      }
    } catch (e) {
      checked.push({ url, ok: false, status: 0 });
    }
  }
  return { url: asset.placeholder, usedFallbackIndex: -1, usedPlaceholder: true, checked };
}
