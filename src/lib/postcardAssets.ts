/**
 * Frontend mirror of supabase/functions/_shared/postcard-assets.ts.
 *
 * MUST stay in sync with the edge function. The admin "Asset Parity Check"
 * (see PostcardAssetDebugPanel) calls send-postcards with `check_assets`
 * and compares the canonical URLs returned by the edge function against
 * the URLs listed here. If they diverge, the panel flags it red.
 */

export const POSTCARD_ASSET_VERSION_LOCAL = "2026-04-21-v1";

export const POSTCARD_ASSETS_LOCAL = {
  matt_photo: {
    label: "Matt founder photo (front, lower-left card)",
    candidates: [
      "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg",
      "https://mattmichelstraining.com/images/matt-boat.jpg",
      "https://detroitwebagent.com/images/matt-boat.jpg",
    ],
  },
  dwa_badge: {
    label: "Detroit Web Agency circle badge (front, right column)",
    candidates: [
      "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png",
      "https://detroitwebagent.com/images/dwa-badge.png",
    ],
  },
} as const;

/**
 * Inline SVG placeholders — used by the React preview if every CDN URL in
 * the candidate chain fails to load (matches the edge function so the
 * preview is honest about what would actually get mailed in that case).
 */
export const PHOTO_PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="#161b22"/><rect x="1" y="1" width="78" height="78" rx="11" fill="none" stroke="#30363d" stroke-width="2"/><text x="40" y="50" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" fill="#e6edf3" text-anchor="middle">MM</text></svg>`
  );

export const BADGE_PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46" fill="#0d1117" stroke="#00d4ff" stroke-width="3"/><text x="48" y="58" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="900" fill="#00d4ff" text-anchor="middle">DWA</text></svg>`
  );
