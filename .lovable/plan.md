

# Fix Share Buttons in Check-In / Milestones

## Problem
The share buttons in `StudioCheckIn.tsx` (lines 211-233 and 321-329) use:
1. `navigator.share()` — only works on mobile + HTTPS, not available on desktop Chrome
2. `navigator.clipboard.writeText()` — fails silently in iframe contexts (Lovable preview) due to Permissions-Policy restrictions

When both fail, the user gets zero feedback — buttons appear broken.

## Fix

**File: `src/components/sessions/StudioCheckIn.tsx`**

1. Wrap clipboard calls in try/catch with a `document.execCommand('copy')` fallback (textarea trick) for environments where the Clipboard API is blocked
2. Add error toast when all methods fail so the user always gets feedback
3. Apply the same fix to both:
   - The top "SHARE" button (`handleShare`, line 211)
   - Each milestone's individual share icon (inline handler, line 322)

**Helper approach:** Create a small `copyToClipboard(text)` utility that tries Clipboard API first, falls back to `execCommand`, and throws if both fail. Use it in both share handlers.

## Changes
| File | Change |
|------|--------|
| `src/components/sessions/StudioCheckIn.tsx` | Add robust clipboard fallback + error toasts to both share handlers |

