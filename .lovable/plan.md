

# Plan: Switch GBP Posts to Direct Anthropic API Call

Change `AdminGbpPosts.tsx` to call the Anthropic API directly from the client instead of the edge function. The component structure (tabs, cards, copy button) already exists and stays the same.

---

## Security Note

Calling Anthropic directly from the browser exposes the API key in network requests. Since this is an admin-only page behind authentication + role check, the risk is limited to admin users. However, the API key must be stored somewhere accessible to the client.

---

## Changes

### `src/components/admin/AdminGbpPosts.tsx`
- Remove `supabase.functions.invoke("generate-gbp-posts")` call
- Replace with direct `fetch("https://api.anthropic.com/v1/messages")` using:
  - Model: `claude-sonnet-4-20250514`
  - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, `content-type: application/json`
  - System prompt per mode (training / webdesign) as specified
  - User message: "Generate the 4 posts now. Return only the JSON array."
- Parse `response.content[0].text` as JSON
- Keep existing error handling pattern (toast on failure)
- The API key will be read from a constant or environment variable

### API Key Storage
The Anthropic API key needs to be accessible client-side. Two options:
1. Store as a Vite env var (`VITE_ANTHROPIC_API_KEY`) — requires adding to `.env` or build config
2. Hardcode in the component (admin-only, not ideal but functional)

I'll use a Vite env var approach and prompt you to provide the key as a build secret or I can store it as a runtime secret and proxy through an edge function (but you explicitly want direct client calls).

---

## Files

| File | Action |
|------|--------|
| `src/components/admin/AdminGbpPosts.tsx` | **Edit** — replace edge function call with direct Anthropic fetch |

---

## Blocker

I need the Anthropic API key to proceed. How would you like to provide it? I can add it as a secret that you enter, then reference it via a Vite env var for client-side access.

