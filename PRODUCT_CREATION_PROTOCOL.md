# Printify Product Creation Protocol
*Version 4 — updated for pod-new-products v2 / printify-product-creator v84*

---

## THE SINGLE RULE (applies to ALL agents: Claude Code, Lovable, any future AI)

> **The ONLY way to create a new Printify product is to insert a row into `pod_product_queue`.**
> Never call `printify-product-creator` directly to create products.
> Never call `printify-direct-publish`.
> This rule applies to Claude Code sessions, Lovable, and any other AI agent or automation.

The queue guarantees: correct blueprint IDs, correct scales, correct image prompts, SEO-optimized titles, and proper error recovery. Bypassing it has previously created 165 broken products that required mass repair. **Do not bypass it.**

---

## How Products Are Created Now (Automated)

**Do not manually create products via the API unless asked.** The system is fully automated:

| Time (UTC) | What happens |
|---|---|
| 8:00am | `multi-trend-scanner` scrapes 50 trending sources (Redbubble, Amazon, Reddit, Etsy) |
| 9:00am | `etsy-trend-scanner` pulls top Etsy listings by niche and stores favorer counts |
| 9:00am | `pod-new-products` reads yesterday's top 5 niches by favorer count → AI-generates 5 products → inserts into `pod_product_queue` |
| 9–1pm | `pod-new-products` runs 5 times, creating 1 product per run from the queue |
| 11:00am | `pod-publisher` publishes any unpublished Printify products to Etsy |
| 12:00pm | `pod-autopilot` cleans up duplicates, publishes stragglers |
| 2:00pm | `pod-seo-agent` AI-refreshes 5 live Etsy listings (rolling 30-day sweep) |

**Net result: 5 new products on Etsy every day, types chosen by what's actually trending.**

---

## Product Type Selection Logic

The system picks product types based on which niches had the most Etsy favorers the day before. It uses keyword matching + a variety cap (max 2 of any type per day) so you always get a mix:

| If niche contains... | Product type chosen |
|---|---|
| "mug", "coffee mug", "coffee cup" | mug |
| "shirt", "tee", "t-shirt" | tshirt |
| "hoodie", "sweatshirt", "pullover" | hoodie |
| "sock", "socks" | sock |
| "hat", "cap" | hat |
| "mousepad", "mouse pad" | mousepad |
| "onesie", "baby", "infant", "bodysuit" | onesie |
| (no keyword match) | least-used type that day |

---

## Supported Product Types

| Type | Blueprint ID | Price | Scale | Notes |
|---|---|---|---|---|
| `mug` | 68 | $18.99 (1899¢) | 0.30 | **Design FILLS full canvas** — scale=0.30 maps full image to front face; see mug rules below |
| `tshirt` | 12 | $22.99 (2299¢) | 1.0 | Full front print |
| `hoodie` | 77 | $38.99 (3899¢) | **0.60** | Transparent bg; center 70% width; **10% top AND bottom margins** — prevents top/bottom crop |
| `sock` | 365 | $18.99 (1899¢) | 3.5 | ArtsAdd crew socks — 4 print areas (all 4 legs). Scale 3.5 fills full leg height. Vibrant colored background required (white is invisible on white sock). |
| `hat` | 1447 | $27.99 (2799¢) | 0.5 | Front panel only, compact design |
| `mousepad` | 608 | $19.99 (1999¢) | 0.85 | Full surface |
| `onesie` | 568 | $18.99 (1899¢) | **0.75** | Baby bodysuit front — center 75% width × 70% height, 12% margin all sides |
| `tumbler` | 353 | $34.99 (3499¢) | **0.22** | 20oz stainless steel — center 75% width × 80% height (see tumbler rules below) |
| `blanket` | 238 | $54.99 (5499¢) | 1.0 | Sherpa throw blanket — full surface print |
| `sweatshirt` | 49 | $39.99 (3999¢) | **0.60** | Crewneck sweatshirt — transparent bg; center 70% width; 10% top AND bottom margins |
| `longsleeve` | 41 | $29.99 (2999¢) | 1.0 | Long sleeve tee — TRANSPARENT BG required |
| `travelmug` | 70 | $29.99 (2999¢) | **0.22** | Insulated travel mug — center 75% width × 80% height (see tumbler rules below) |
| `petbandana` | 562 | $14.99 (1499¢) | 0.85 | Dog/cat bandana — TRIANGULAR SHAPE; design in center 50% only (see bandana rules) |
| `coaster` | 480 | $12.99 (1299¢) | 0.85 | Cork coaster — CIRCULAR die-cut; all content in inner 70% radius (see coaster rules) |
| `ornament` | 530 | $17.99 (1799¢) | 0.85 | Ceramic ornament — design must fill 90% of circular disc (see ornament rules) |
| `poster_v` | 852 | $21.99 (2199¢) | 1.0 | Vertical wall art poster — FULL-BLEED, zero white border (see poster rules) |
| `poster_h` | 852 | $21.99 (2199¢) | 1.0 | Horizontal wall art poster — FULL-BLEED, zero white border (see poster rules) |
| `puzzle` | 611 | $39.99 (3999¢) | 1.0 | Jigsaw puzzle — FULL-BLEED edge-to-edge, zero padding (see puzzle rules) |
| `wineglass` | 1250 | $24.99 (2499¢) | **0.40** | Flat label artwork only — colored rectangle center 70%×60%; NO 3D glass renders (see glass rules) |
| `pintglass` | 633 | $22.99 (2299¢) | **0.35** | Flat label artwork only — colored rectangle center 70%×60%; NO 3D glass renders (see glass rules) |
| `shotglass` | 787 | $19.99 (1999¢) | **0.25** | Flat label artwork only — colored circle/rect center 65%×55%; max 2–3 words (see glass rules) |
| `candle` | 755 | $27.99 (2799¢) | **0.85** | Full-canvas colored label — NO candle/jar 3D renders; fills entire canvas edge-to-edge (see candle rules) |
| `greetingcard` | 785 | $6.99 (699¢) | 1.0 | Portrait card — face/bust only if character; 15% margins all sides |
| `journal` | — | $22.99 (2299¢) | 1.0 | Front cover only; left 20% = pure white spine zone; all content in right 75% of canvas |

**Tote bags are no longer supported** (removed in v42). Do not use `type: "tote"`.

**AOP garment rule (leggings, tanktop, croptop, joggers):** Design must be full-canvas seamless — ZERO white pixels anywhere in the canvas. Rich saturated colors only. Use a seamless tiling pattern so edges connect when fabric is seamed. Image prompt must specify "seamless all-over print pattern, full canvas coverage, no white areas."

**Journal rule:** Design must be FRONT COVER ONLY — all content within the RIGHT 75% of canvas (pixels 200–950 of a 1000px canvas). Left 20% = spine zone — MUST be pure white, absolutely no design elements. Prompt must NOT say "full-bleed edge-to-edge." Old rule was "left 10% = spine" — this was too weak; AI ignored it and text bled into spine.

---

## How to Manually Queue a Product

If you need to add a specific product (e.g., for a seasonal campaign or user request), insert directly into `pod_product_queue`:

```sql
INSERT INTO pod_product_queue (name, product_type, image_prompt, description, tags, retail_price, status)
VALUES (
  'Funny Nurse Life Mug – Running on Coffee and Chaos',
  'mug',
  'Bold graphic design: large bold text "Nurses: Because Doctors Need Heroes Too" with stethoscope icon, fills full canvas, clean white background, high contrast',
  'The perfect gift for any nurse.',
  '{}',
  1899,
  'pending'
);
```

The next `pod-new-products` run (9–1pm UTC) will pick it up automatically. **Do not call `printify-product-creator` directly** — let the queue handle it.

---

## Manual Product Creation via API (EMERGENCY ONLY — Queue System Down)

**⚠ Only use this if the `pod_product_queue` + `pod-new-products` pipeline is confirmed broken and Matt has explicitly asked for a direct creation. Under all normal circumstances, use the queue.**

```bash
curl -s -X POST \
  "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator" \
  -H "Authorization: Bearer eyJ.REDACTED.JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "name": "Funny Nurse Mug – Running on Coffee and Chaos",
      "type": "mug",
      "imagePrompt": "Bold graphic: text Running on Coffee and Chaos with stethoscope, fills full canvas, white background, large bold text",
      "description": "Perfect gift for nurses.",
      "tags": [],
      "retailPrice": 1899
    }
  }' \
  --max-time 150
```

**Rules:**
1. Always `--max-time 150` — function takes 90–135s
2. If it times out, check Printify before retrying — product may already be created
3. SEO (title, tags, description) is auto-optimized by GPT-4o-mini inside the function — your inputs are a starting point only

---

## Mug Design Rules (CRITICAL — Non-Negotiable)

| Parameter | Value | Why |
|---|---|---|
| `scale` | `0.30` | Printify maps the **full image canvas** to the front face of the mug only — prevents wrap-around |
| Design coverage | **FILLS the full canvas** — bold art extending to all 4 edges | scale=0.30 already handles placement; constraining the design inside a sub-region creates a postage-stamp effect |
| Background | Pure white `#FFFFFF` | No cream, off-white, or gradients |
| Text size | Minimum 15% of canvas height per line | Must be readable on the mug front |

**CRITICAL BUG HISTORY:** Previous versions constrained the design to "pixels 350–650" (center 30% of canvas). Combined with scale=0.30 this shrank the visible design to 9% of the mug surface — a barely-visible postage stamp. **Never add pixel constraints to mug prompts.** Design MUST fill the full canvas. Printify's scale parameter handles where on the cylinder the image lands.

Image prompt must say: *"FILL THE ENTIRE IMAGE CANVAS with bold, large artwork. Large, legible typography centered on the canvas. Minimum 15% canvas height per line of text. Pure white background."*

---

## Tumbler / Travel Mug Design Rules (CRITICAL — Different from Mug)

| Parameter | Mug | Tumbler / TravelMug | Why different |
|---|---|---|---|
| `scale` | 0.30 | **0.22** | Tumbler print area maps wider — scale=0.30 wraps past the visible front face causing text cutoff at both edges |
| Design zone | Fill full canvas | **Center 75% width × 80% height** (12.5% margin each side; 10% top/bottom) | Prevents wrap-around; keeps design on visible front face |
| Background | Pure white | Pure white | — |

**CRITICAL BUG HISTORY (Phase 103):** The mug fix (fill full canvas + scale=0.30) was applied to tumblers too. This caused text to wrap all the way around the cylinder — letters cut off at both edges. Tumblers have a different print area ratio from mugs: at scale=0.30 the full canvas image exceeds the visible front face. The fix: scale=0.22 + constrain design to center 75%×80% of canvas.

**Never use scale=0.30 for tumbler/travelmug/tumbler40.** Always use 0.22.

**To fix existing bad mug designs:**
```bash
curl -s -X POST "...url..." -H "..." -d '{"repairMugs":true,"offset":0}' --max-time 150
# Repeat with nextOffset until null
```

---

## Sock Design Rules

Socks use blueprint 365 (ArtsAdd crew socks — full sublimation). The API call creates **4 print areas automatically**: `front_left_leg`, `front_right_leg`, `back_left_leg`, `back_right_leg`. The image is tiled across all four. Design should work as a repeating pattern or standalone graphic. **Use a VIBRANT COLORED background** — white is invisible against the white sock body.

---

## Apparel Design Rules (tshirt, hoodie, sweatshirt, longsleeve)

| Rule | Value |
|---|---|
| Background | **TRANSPARENT** — no white box, no rectangle, no frame |
| Image generation | Uses `background: "transparent"` (PNG with alpha channel) |
| Scale | 1.0 (tshirt/longsleeve), 0.60 (hoodie/sweatshirt) |
| Content zone | Center 70% of canvas width; 10% top AND bottom margin |

**Critical**: DALL-E will add a white rectangle behind the design if prompted without explicit transparency constraints. New product creation automatically uses `generateImageTransparent()` for all apparel types. **Never use `background: "opaque"` for apparel.**

To fix existing sticker-on-shirt products:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairApparel":true,"offset":0}' --max-time 150
```

---

## Pet Bandana Design Rules (petbandana, blueprint 562)

| Rule | Value |
|---|---|
| Shape | Triangular when worn — a square folded diagonally |
| Safe zone | Center 50% of canvas width AND center 50% of canvas height |
| Content limit | 1–2 bold words maximum + 1 simple icon |
| Background | Pure white |
| Font size | Large/chunky only — no small text |

**Critical**: The corners of the bandana are hidden by the fold and knot. Any text or design outside the center diamond zone will be invisible or clipped. The `buildPrompt` enforces "nothing within 25% of any edge."

To fix existing bandanas with overflowing text:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairPetbandanas":true,"offset":0}' --max-time 150
```

---

## Coaster Design Rules (coaster, blueprint 480)

| Rule | Value |
|---|---|
| Shape | **Circular** — die-cut circle |
| Safe zone | Inner 70% of canvas radius from center |
| Edge margin | At least 15% pure white from every canvas edge |
| Text zone | Center 60% of canvas only |
| Background | Pure white |

**Critical**: Text outside the inner 70% zone will be clipped by the circular die-cut. The `buildPrompt` explicitly prohibits content near edges.

To fix existing coasters with clipped text:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairCoasters":true,"offset":0}' --max-time 150
```

---

## Ornament Design Rules (ornament, blueprint 530)

| Rule | Value |
|---|---|
| Print area | Single circular disc (front only) |
| Scale | 0.85 |
| Design fill | Must fill 90% of the circular disc — NOT a tiny design |
| Text | Max 3 words, large and chunky |
| Background | Pure white outside the disc |

**Critical**: The print disc must be filled with a bold design. A tiny design centered in white space is the failure mode — always push the design to fill the disc.

To fix existing ornaments with small/blank designs:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairOrnaments":true,"offset":0}' --max-time 150
```

---

## Poster Design Rules (poster_v / poster_h, blueprint 852)

| Rule | Value |
|---|---|
| Bleed | FULL-BLEED — 100% edge-to-edge, ZERO white border |
| Scale | 1.0 |
| Background | Design background bleeds to every edge — no white frame/mat |
| Text | ONLY the exact words in the prompt |

**Critical**: Do NOT add "Pure white background" to poster prompts. DALL-E will render the design as a box on a white canvas with a white border. The correct behavior is for the design itself (dark or colored background) to fill the entire canvas.

To fix existing posters with white border frames:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairPosters":true,"offset":0}' --max-time 150
```

---

## Puzzle Design Rules (puzzle, blueprint 611)

| Rule | Value |
|---|---|
| Bleed | FULL-BLEED — 100% edge-to-edge, ZERO white border |
| Scale | 1.0 |
| Background | Fills entire canvas — no dead space, no padding |
| Colors | High contrast, vibrant — puzzle is a gift item |

**Critical**: The puzzle image must fill every pixel of the canvas. White dead space at edges looks unprofessional. Use `scale: 1.0` and the `buildPrompt("puzzle")` which enforces full-bleed explicitly.

To fix existing puzzles with white borders:
```bash
curl -s -X POST "$BASE" -H "$AUTH" -d '{"repairPuzzles":true,"offset":0}' --max-time 150
```

---

## Wine Glass / Pint Glass / Shot Glass Design Rules (FLAT LABEL ARTWORK ONLY)

**CRITICAL BUG HISTORY (Phase 103):** Old prompts used "DECAL BACKGROUND RULE" language which caused DALL-E to render 3D product mockups — a picture of a wine glass or shot glass sitting on a surface, with the design printed on it. The generated image was literally a photo of the product, not a flat label.

The prompt MUST be treated as generating a flat sticker/label design file, not a product photo:

| Rule | Wine Glass | Pint Glass | Shot Glass |
|---|---|---|---|
| AI must NOT draw | a wine glass, any 3D object, any product | a pint glass, any 3D object | a shot glass, any 3D object |
| Label background | Bold dark/vibrant colored rectangle | Bold dark/vibrant colored rectangle | Bold dark/vibrant colored circle/rect |
| Label size | Center 70% width × 60% height | Center 70% width × 60% height | Center 65% width × 55% height |
| Text | Large bold white — main focal point | Large bold white — main focal point | 2–3 words max, very large font |
| Background outside label | Pure white margins | Pure white margins | Pure white margins |
| Scale | **0.40** | **0.35** | **0.25** |

**The prompt must explicitly say:** *"DO NOT DRAW A WINE GLASS. DO NOT DRAW ANY 3D OBJECT. THIS IS FLAT LABEL ARTWORK ONLY."*

**Quality check rule:** If the generated image shows a 3D product rendering (an actual glass), `scoreImageQuality` hard-fails it (score=1) and regenerates.

---

## Candle Design Rules (FLAT LABEL ARTWORK — FULL CANVAS)

**CRITICAL BUG HISTORY (Phase 103):** Two compounding mistakes: (1) old prompt constrained to "center 60% canvas × center 70% canvas height", (2) scale was 0.45. Combined this made the visible label about 27% of the candle jar surface — a tiny postage stamp. Also, the prompt didn't explicitly forbid drawing a 3D candle, so DALL-E sometimes rendered the jar itself.

| Rule | Value |
|---|---|
| Scale | **0.85** |
| Canvas coverage | **FULL CANVAS edge-to-edge** — colored background fills every pixel |
| AI must NOT draw | a candle, a jar, a flame, any 3D object, any product |
| Background | Rich saturated color filling the ENTIRE canvas (red, green, navy, gold, etc.) |
| Text size | Large, bold, centered — readable at 3-inch label size |

**Never add canvas pixel constraints to candle prompts.** The colored background must fill the entire image.

**Quality check rule:** If the generated image shows a 3D candle or jar, `scoreImageQuality` hard-fails it (score=1).

---

## Greeting Card Design Rules

| Rule | Value |
|---|---|
| Orientation | Portrait |
| Character rule | **Face/bust ONLY** — head and shoulders; NEVER full body from head to toe |
| Margins | 15% on all sides — nothing touching card edge |
| Background | Pure white |

**CRITICAL BUG HISTORY (Phase 103):** Old prompt said "Full-bleed illustration" → DALL-E drew full-body characters with legs hanging below the card face. The fix: explicit "FACE/BUST ONLY — DO NOT draw a full body from head to toe."

---

## Journal Cover Design Rules

| Rule | Value |
|---|---|
| Content area | Right 75% of canvas (pixels 200–950 of a 1000px canvas) |
| Spine zone | Left 20% of canvas (pixels 0–200) — **MUST be pure white, absolutely NO design elements** |
| Vertical zone | Center 80% of canvas height |
| Background | Pure white or solid color |

**CRITICAL BUG HISTORY (Phase 103):** Old prompt said "left 10% = spine area" — too small, AI ignored it consistently. Text bled into the spine and was cut off on the physical product. Fix: increased to 20% with explicit pixel coordinates.

---

## Repair & Maintenance Commands

```bash
BASE="https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator"
AUTH="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Fix all mug designs (scale + centering)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairMugs":true,"offset":0}' --max-time 150

# Fix all shirt/hoodie/sweatshirt/longsleeve (transparent background — eliminates sticker-on-shirt effect)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairApparel":true,"offset":0}' --max-time 150

# Fix coasters (text inside circular die-cut zone)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairCoasters":true,"offset":0}' --max-time 150

# Fix ornaments (design fills circular disc, not tiny)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairOrnaments":true,"offset":0}' --max-time 150

# Fix pet bandanas (design within triangular safe zone)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairPetbandanas":true,"offset":0}' --max-time 150

# Fix posters (full-bleed, no white border frame)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairPosters":true,"offset":0}' --max-time 150

# Fix puzzles (full-bleed edge-to-edge, no white padding)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"repairPuzzles":true,"offset":0}' --max-time 150

# SEO-update + reprice all existing listings (3 at a time, repeat with nextOffset)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"updateAll":true,"offset":0}' --max-time 150

# Publish all unpublished products to Etsy
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"publishAll":true}' --max-time 150

# List recent products (paginated)
curl -s -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"listRecent":true,"page":1}' --max-time 30
```

---

## Queue Health Check

```sql
-- See what's pending/processing/published/errored
SELECT product_type, status, COUNT(*) FROM pod_product_queue GROUP BY product_type, status ORDER BY status;

-- See today's trend-driven queue entries
SELECT id, name, product_type, status, created_at FROM pod_product_queue
WHERE created_at >= NOW() - INTERVAL '24 hours' ORDER BY id;

-- Reset stuck processing items manually
UPDATE pod_product_queue SET status = 'pending' WHERE status = 'processing';
```

---

## For All AI Agents (Claude Code, Lovable, and any future agent)

These rules apply equally to every AI that touches this codebase. There is no exception for Claude vs. Lovable vs. any other tool.

**DO:**
- Insert rows into `pod_product_queue` when Matt asks for a specific product
- Read `pod_product_queue` to show Matt queue status and recent creates
- Read `etsy_pod_trends` to show what's trending and why today's products were chosen
- Call repair modes (`repairMugs`, `repairApparel`, `repairOnesies`, `repairJournals`, `repairCylindrical`, etc.) if existing designs look wrong
- Call `publishAll` to push repaired/unpublished products to Etsy

**DO NOT (applies to Claude AND Lovable):**
- Call `printify-product-creator` directly to create new products — **always use the queue**
- Call `printify-direct-publish` (Lovable-side function) — it uses `imagescript` which OOMs on large images and produces wrong-dimension listings. This function created 165 broken products that had to be mass-repaired. **Never use it again, ever.**
- Use `type: "tote"` — blueprint removed, will error
- Create more than 1 product per direct API call — always `count:1`
- Assume a timed-out call failed — check Printify first
- Use any blueprint ID not listed in the Supported Product Types table above — unknown blueprints cannot be auto-repaired with correct specs
- Use scale values not listed in the Supported Product Types table — wrong scale = cropped or wrapped designs that require mass repair

---

## Digital Download Products Protocol (etsy-digital-product-creator)

This section covers all Etsy digital products created via `etsy-digital-product-creator` (NOT the Printify queue).

### Step-by-Step Creation Process

1. **Queue products via competitor scout:**
   ```bash
   curl -s -X POST ".../functions/v1/etsy-digital-competitor-scout" -H "..." -d '{}'
   ```
   Returns up to 10 products queued in `pod_product_queue` with `source='competitor_scout'`, priced 12% below top Etsy competitor (minimum $3.99).

2. **Create each product sequentially (60-90s each):**
   ```bash
   curl -s -X POST ".../functions/v1/etsy-digital-product-creator" \
     -H "..." -d '{"recreateFromQueueId":true,"queueId":N}' --max-time 200
   ```
   Function: generates real files (STL/SVG/DXF/CSV/YAML), packs ZIP, generates cover image, creates Etsy listing, uploads ZIP.

3. **Activate all new listings (Etsy always creates as `draft`):**
   Fetch listing IDs from DB: `SELECT etsy_listing_id FROM pod_digital_products WHERE queue_id BETWEEN N AND M`
   Then batch-patch in groups of 10:
   ```bash
   curl -s -X POST ".../functions/v1/etsy-digital-product-creator" \
     -H "..." -d '{"patchListings":[{"listingId":"ID1","state":"active"},...]}'
   ```
   **DO NOT use `repairActivate` mode for large batches** — it uses `Promise.all()` and times out at 150s (WORKER_RESOURCE_LIMIT) when patching 10+ listings.

4. **Verify files exist — MANDATORY after every creation batch:**
   ```bash
   curl -s -X POST ".../functions/v1/etsy-digital-product-creator" \
     -H "..." -d '{"auditFiles":true,"offset":0,"limit":20}'
   ```
   ✅ Expect: `"missing": 0` and every listing shows `fileCount ≥ 1`.
   ❌ If any show `fileCount: 0` → `auditFiles` auto-repairs by re-uploading. Re-run until `missing: 0`.

   **For `etsy-digital-uploader` (wall art 3-packs):** use offset=80+ to reach newest rows:
   ```bash
   curl -s -X POST ".../functions/v1/etsy-digital-product-creator" \
     -H "..." -d '{"auditFiles":true,"offset":80,"limit":20}'
   ```
   Expect `fileCount: 3` for every wall art listing. A listing with 0 files = buyer receives nothing after purchase.

   **This step is NOT optional.** A listing with no files is live on Etsy, charges the buyer, and delivers nothing. Always verify before considering any digital batch complete.

### Known Permanent Limitations

| Limitation | What it means | Action |
|---|---|---|
| `is_digital: false` | All listings show `is_digital=false` via API — development app restriction | Accept it. Buyers can still download files. Cannot be fixed without Etsy app certification. |
| `state: "active"` in POST ignored | Every listing starts as `draft` regardless of POST body | Always run step 3 (patchListings) after creation |
| `type: "download"` cannot change | Etsy ignores `type` PATCH after creation | If wrong type created, use `recreateFromQueueId` — deletes old listing and recreates fresh |

### Title Sanitization (automatic — no manual action needed)

`etsy-digital-product-creator` applies these fixes to every GPT-generated SEO title BEFORE sending to Etsy:

| Rule | Code | Reason |
|---|---|---|
| Replace all `&` with `and` | `.replace(/&/g, "and")` | Etsy rejects titles with >1 ampersand |
| Replace `:` with `-` | `.replace(/:/g, "-")` | Etsy rejects colons in titles |
| Lowercase excess ALL_CAPS words | regex count >3 | Etsy rejects >3 words starting with 2+ sequential caps (CNC, DXF, SVG, STL, PDF count) |

If a listing fails with a title error, update the queue name in `pod_product_queue` to avoid the pattern, then retry with `recreateFromQueueId`.

### Monthly Maintenance

Run `auditDeepCheck` monthly to verify all listings are active and have files:
```bash
curl -s -X POST ".../functions/v1/etsy-digital-product-creator" \
  -H "..." -d '{"auditDeepCheck":true,"offset":0,"limit":10}'
```
Note: Etsy rate limits this to ~10 calls/day. Run in batches across multiple days if needed.
