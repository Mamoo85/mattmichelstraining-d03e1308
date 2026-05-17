## Goal
Research Etsy trends, design 10 distinct products across mug/tshirt/hoodie/tote, and publish each via the `printify-product-creator` edge function.

## Approach

### Step 1 — Market research (websearch)
Run parallel `websearch--web_search` queries to surface current Etsy trending niches, low-competition opportunities, and seasonal angles for the next 30–60 days (late spring/early summer 2026: Father's Day, Pride Month, graduation, wedding season, summer hobbies). Validate each candidate niche by checking it's not in the avoid list (generic dog mom, best dad ever, oversaturated pop culture).

### Step 2 — Pick 10 niches across product types
Target mix:
- 3× mug ($13.99) — gifting/humor/identity
- 3× tshirt ($17.99) — community/pride/humor
- 2× hoodie ($32.99) — cozy identity statements
- 2× tote ($15.99) — hobby/lifestyle

Every niche must hit a distinct buyer persona (e.g. ER nurse humor ≠ teacher humor ≠ pickleball ≠ sourdough baker ≠ trail runner ≠ book club ≠ new dad ≠ plant parent ≠ D&D ≠ crocheter — final list TBD by research).

### Step 3 — Build product specs
For each of the 10, generate:
- Etsy-optimized title (keyword-front-loaded, ≤140 chars)
- 2–3 sentence identity-led description
- 6 tags (mix of broad + long-tail)
- DALL-E image prompt following strict print rules:
  - Mugs: design ≤50% width, 35% side padding, 20% top/bottom, pure #FFFFFF bg
  - Apparel/totes: ≥15% padding all sides, fully visible, pure #FFFFFF bg
  - All: high contrast, clean edges, no gradients/faces/watermarks

### Step 4 — Publish sequentially
Use `code--exec` with a bash loop running 10 sequential `curl` POSTs to:
`https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator`

Sequential (not parallel) because each call takes 60–90s and the upstream function rate-limits. Capture every response (printifyId, etsyListingId, listing URL, errors) to a JSON log at `/mnt/documents/etsy-batch-{timestamp}.json`. Timeout per call: 180s. On failure, log and continue (don't abort the batch).

### Step 5 — Report
Final summary table per product:
1. Name
2. Niche / buyer
3. Market signal that justified it
4. Etsy listing URL (or failure reason)

Plus deliver the full JSON log as a `<presentation-artifact>` for the user to download.

## Notes
- This is a pure script-execution task — no project source files will be modified.
- The edge function lives in a different Supabase project (`zmyczlfuufhngzovkjdh`), so I cannot inspect/modify it; I'll trust its contract as documented.
- Expected total runtime: ~12–15 minutes for 10 sequential publishes.
