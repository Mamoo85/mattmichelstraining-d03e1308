# Etsy + 3D POD Pipeline Architecture
*Last updated: 2026-05-23 — Phase 73*

This document covers:
1. [2D Etsy/Printify Pipeline Hardening](#1-etsy--printify-pipeline-hardening) — all fixes deployed in Phase 73
2. [STL Digital Downloads](#2-stl-digital-downloads) — zero-infra 3D revenue channel via existing `etsy-digital-uploader`
3. [Physical 3D Print-on-Demand](#3-physical-3d-print-on-demand-deploy-later) — full design, not yet deployed

---

## 1. Etsy / Printify Pipeline Hardening

### 1a. Etsy OAuth Auto-Refresh (`etsy-oauth-refresh`)

**Problem:** Etsy OAuth tokens expire after 3,600s. If the cron doesn't refresh before expiry, all Etsy API calls fail silently — listings don't publish, token errors are swallowed.

**Deployed:** `supabase/functions/etsy-oauth-refresh/index.ts`  
**Cron:** `0 2,14 * * *` (2am + 2pm UTC, every 12h)  
**Migration:** `supabase/migrations/20260523230000_etsy_oauth_refresh_cron.sql`

```typescript
// Simplified pseudocode — see actual file for full implementation
const row = await sb.from("etsy_oauth_tokens").select("*").order("updated_at", {ascending: false}).limit(1).single();
const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: Deno.env.get("ETSY_API_KEY")!,
    refresh_token: row.refresh_token,
  }),
  signal: AbortSignal.timeout(15_000),
});
// On failure: SMS Matt immediately
// On success: UPDATE etsy_oauth_tokens SET access_token, refresh_token, expires_at
```

**Secrets required on primary project (`eauvubfpanpeuxsrqesu`):**
- `ETSY_API_KEY` — Etsy app key (same as OAuth start flow)

---

### 1b. Printify Rate-Limit-Aware Client (`_shared/printify.ts`)

**Problem:** Printify silently accepts calls when rate-limited, then returns 429. Callers didn't check `X-RateLimit-Remaining`, leading to rapid burst → ghost records → silent failures.

**Deployed:** `supabase/functions/_shared/printify.ts`

```typescript
export interface PrintifyResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
  rateRemaining: number | null;
}

export async function printifyFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; apiKey: string },
): Promise<PrintifyResponse<T>> {
  const BASE = "https://api.printify.com";
  const backoffMs = [1000, 4000, 16000];
  
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "m2training/1.0",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    
    const rateRemaining = parseInt(res.headers.get("X-RateLimit-Remaining") ?? "") || null;
    
    // Auto-throttle when approaching limit
    if (rateRemaining !== null && rateRemaining <= 5) {
      await delay(5000);
    }
    
    if (res.status === 429) {
      if (attempt < backoffMs.length) {
        await delay(backoffMs[attempt]);
        continue;
      }
      throw new Error(`PRINTIFY_429: rate limited on ${path} after ${attempt} retries`);
    }
    
    const body = await res.json().catch(() => res.text());
    return { ok: res.ok, status: res.status, body: body as T, rateRemaining };
  }
  throw new Error("PRINTIFY_UNEXPECTED: loop exhausted");
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
```

---

### 1c. Ghost Record Reconciler (`pod-reconcile-ghosts`)

**Problem:** ~58 rows in `pod_product_queue` have `status='published'` but `printify_id IS NULL` — products were marked published during Printify outages. These represent wasted AI generation spend and missing Etsy listings.

**Deployed:** `supabase/functions/pod-reconcile-ghosts/index.ts`  
**Cron:** `0 0,6,12,18 * * *` (every 6h)  
**Migration:** `supabase/migrations/20260523230001_pod_publish_hardening.sql`

**New columns added to `pod_product_queue`:**
```sql
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS publish_attempt_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_permanently bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_publish_error text;
```

**Logic:**
1. Find rows: `status='published' AND printify_id IS NULL AND failed_permanently=false AND product_type!='digital'`
2. For each: if `publish_attempt_count >= 3` → mark `failed_permanently=true` → SMS Matt
3. Otherwise: call `printify-product-creator` with `{ repairProductId: item.id }` → store returned `printifyId`

---

### 1d. Circuit Breaker in `pod-new-products`

**Problem:** When Printify is down, `pod-new-products` burns all 5 daily queue slots on 5 consecutive failures. No alert, no halt.

**Fix:** Persists `consecutive_printify_failures` count to `pod_agent_state` table (key-value store). After 3 consecutive failed runs (across cron invocations), sends SMS and stops processing.

```typescript
// Simplified — see pod-new-products/index.ts for full implementation
const { data: cbState } = await sb.from("pod_agent_state")
  .select("value").eq("key", "consecutive_printify_failures").maybeSingle();
const consecutiveFailures = parseInt(cbState?.value ?? "0", 10);

// ... after processing ...
if (!succeeded) {
  const newCount = consecutiveFailures + 1;
  await sb.from("pod_agent_state").upsert({ key: "consecutive_printify_failures", value: String(newCount) });
  if (newCount >= 3) {
    await sendSMS(ADMIN_PHONE, TWILIO_FROM, `🔴 pod-new-products circuit breaker: ${newCount} consecutive failures`, "pod_circuit_break");
  }
} else {
  if (consecutiveFailures > 0) {
    await sb.from("pod_agent_state").upsert({ key: "consecutive_printify_failures", value: "0" });
  }
}
```

---

### 1e. Structured Hallucination Reasons

**Problem:** `checkHallucination()` returned `boolean` only. When a listing was blocked, we had no way to know if it was a false positive (natural texture) or real garbled text.

**Fix:** Returns `{ flagged: boolean, reason: string }` using `response_format: json_object`. Reason stored in DB column `hallucination_reason text`.

```typescript
// Returns { has_text: boolean, reason: string } from Gemini Flash
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  body: JSON.stringify({
    model: "google/gemini-flash-1.5",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      { type: "text", text: `Inspect this image. Return JSON: {"has_text": boolean, "reason": "brief explanation"}.
        has_text is true ONLY for garbled/non-English/glitchy characters that are failed text rendering attempts.
        Ignore natural textures, grids, or patterns that faintly resemble letters.
        If clean: {"has_text": false, "reason": "clean visual — no text artifacts"}.` }
    ]}],
    max_tokens: 80,
  }),
});
const result = JSON.parse(response.choices[0].message.content);
return { flagged: result.has_text, reason: result.reason ?? "" };
```

---

## 2. STL Digital Downloads

### Why This Works (Zero New Infra)

Your `etsy-digital-uploader` already:
- Generates files with AI
- Uploads to Supabase Storage
- Creates Etsy listings as digital downloads
- Has hallucination detection

Adding STL files = same pipeline, new file type. JSCAD runs in Deno — no Fly.io worker needed.

### Marketplaces (All Free Until Sale)

| Platform | Listing Fee | Commission | Size |
|---|---|---|---|
| **Etsy** | $0.20/listing | 6.5% | 100M+ buyers |
| **Cults3D** | Free | 20% | 5M+ community |
| **MyMiniFactory** | Free | 4% | 1M+ makers |
| **Printables** (Prusa) | Free | ~0% | Fast-growing |
| **Gumroad** | Free | 10% | General |

**Best starting strategy:** Etsy (already set up) + manual upload to Cults3D. Automate Cults3D API after first 20 listings.

### Top-Selling STL Categories (Verified Etsy demand)

| Category | Avg Price | Search Volume | Effort |
|---|---|---|---|
| Cookie cutter bundles (A-Z, holidays) | $3-6 | Very High | Low |
| Wall hooks / organizers | $4-8 | High | Low |
| Phone/tablet stands | $3-6 | High | Low |
| D&D dice towers / miniature bases | $4-10 | High | Low |
| Kitchen drawer organizers | $5-8 | Medium | Low |
| Cable clip organizers | $2-5 | Medium | Low |

### JSCAD in Deno (No Fly.io Required)

```typescript
// Import JSCAD modeling library (pure JS, works in Deno)
import * as jscad from "npm:@jscad/modeling@2";
import { serializeToStl } from "npm:@jscad/stl-serializer@3";

// Example: parametric cookie cutter
function generateCookieCutter(params: { letter: string; size_mm: number; height_mm: number }) {
  const { union, subtract } = jscad.booleans;
  const { cylinder, cuboid } = jscad.primitives;
  const { translate } = jscad.transforms;
  
  // Outer ring
  const outerCyl = cylinder({ radius: params.size_mm / 2, height: params.height_mm });
  const innerCyl = cylinder({ radius: (params.size_mm / 2) - 1.5, height: params.height_mm + 0.1 });
  const ring = subtract(outerCyl, innerCyl);
  
  // Add handle
  const handle = cuboid({ size: [4, params.size_mm / 3, params.height_mm + 10] });
  const handlePos = translate([params.size_mm / 2 + 2, 0, 5], handle);
  
  return union(ring, handlePos);
}

// Generate STL bytes
const geometry = generateCookieCutter({ letter: "A", size_mm: 50, height_mm: 20 });
const stlBytes = serializeToStl({ binary: true }, geometry);
```

### STL Listing Flow (extend `etsy-digital-uploader`)

```typescript
// Mode: stlBundle
// 1. Pick a template from stl_templates table
// 2. Generate N STL files (e.g., 26 cookie cutters A-Z)
// 3. Bundle into ZIP
// 4. Upload ZIP to Storage: etsy-stl-files/{listing_id}/bundle.zip
// 5. Create Etsy listing as digital download (same as current digital flow)
// 6. Return listing URL

const zipBytes = await buildStlZip(templates, params);
const storagePath = `stl-bundles/${crypto.randomUUID()}.zip`;
await sb.storage.from("etsy-stl-files").upload(storagePath, zipBytes);
// ... then Etsy listing creation (reuse existing createEtsyListing function)
```

### Database Schema (add to existing secondary project)

```sql
CREATE TABLE IF NOT EXISTS stl_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- "Cookie Cutter - Letter Set A-Z"
  category text NOT NULL,          -- "cookie_cutter" | "wall_hook" | "organizer"
  jscad_source text NOT NULL,      -- JSCAD function source code
  param_schema jsonb NOT NULL,     -- JSON schema for valid params
  default_params jsonb NOT NULL,   -- Default param values
  etsy_title_template text,        -- "Printable {category} Bundle — {name} | STL Files for 3D Printing"
  etsy_tags text[],                -- 13 tags
  price_cents int DEFAULT 499,     -- $4.99 default
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stl_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES stl_templates(id),
  etsy_listing_id text,
  storage_path text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','generating','listed','failed')),
  error_msg text,
  created_at timestamptz DEFAULT now()
);
```

---

## 3. Physical 3D Print-on-Demand (Deploy Later)

*Architecture is fully designed. Deploy when you have demand for a specific product — not before.*

### Why Wait

- Shop3D.io / Slant 3D charge per-print (~$12-40/item) — no flat rate like Printify
- Requires Fly.io worker (~$20-30/mo) before first sale
- STL digital downloads have better margins (100%) with zero infra

### Architecture Overview

```
Etsy Order → pod3d-etsy-order-webhook → lookup STL URL → route to print farm
                                          ↑
Etsy Listing ← Blender mockups ← pod3d-generate ← OpenSCAD/JSCAD STL
```

### Fly.io Worker (when ready)

**File:** `infra/openscad-worker/Dockerfile`

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    openscad \
    blender \
    python3 python3-pip \
    nodejs npm \
    && pip3 install trimesh numpy \
    && npm install -g @hono/node-server

COPY server.ts /app/server.ts
WORKDIR /app
EXPOSE 8080
CMD ["npx", "ts-node", "server.ts"]
```

**File:** `infra/openscad-worker/fly.toml`

```toml
app = "m2training-3d-worker"
primary_region = "ord"  # Chicago — close to US Etsy buyers

[build]
  dockerfile = "Dockerfile"

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[vm]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

**File:** `infra/openscad-worker/server.ts`

```typescript
import { Hono } from "npm:hono";
import { exec } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const app = new Hono();
const WORKER_SECRET = process.env.WORKER_SECRET!;

// Auth middleware
app.use("*", async (c, next) => {
  const auth = c.req.header("X-Worker-Secret");
  if (auth !== WORKER_SECRET) return c.json({ error: "unauthorized" }, 401);
  return next();
});

// Generate STL from OpenSCAD source + params
app.post("/generate-stl", async (c) => {
  const { scad_source, params } = await c.req.json();
  const tmpScad = `/tmp/${crypto.randomUUID()}.scad`;
  const tmpStl = tmpScad.replace(".scad", ".stl");
  
  // Inject params as OpenSCAD variables
  const paramLines = Object.entries(params)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)};`).join("\n");
  
  await writeFile(tmpScad, `${paramLines}\n${scad_source}`);
  await execAsync(`openscad -o ${tmpStl} ${tmpScad} --export-format binstl`);
  const stlBytes = await readFile(tmpStl);
  await Promise.all([unlink(tmpScad), unlink(tmpStl)].map(p => p.catch(() => {})));
  
  return c.body(stlBytes, 200, { "Content-Type": "application/octet-stream" });
});

// Render mockup via Blender
app.post("/render-mockup", async (c) => {
  const { stl_url, angles = [0, 45, 90, 135] } = await c.req.json();
  // Download STL, run blender --background with Python script, return PNG array
  // ... (Blender headless rendering implementation)
  return c.json({ mockup_urls: [] }); // placeholder
});

export default app;
```

### Print Farm Webhook Payloads

**Shop3D.io:**
```json
{
  "external_order_id": "etsy_receipt_7890123",
  "shipping_address": {
    "name": "Jane Smith",
    "line1": "123 Main St",
    "city": "Detroit",
    "state": "MI",
    "postal_code": "48201",
    "country": "US"
  },
  "items": [{
    "stl_url": "https://zmyczlfuufhngzovkjdh.supabase.co/storage/v1/object/sign/pod3d-stl/abc.stl?token=...",
    "material": "PLA",
    "color": "black",
    "infill_pct": 20,
    "quantity": 1,
    "layer_height_mm": 0.2
  }],
  "shipping_method": "standard"
}
```

**Slant 3D (POST `/api/order/`):**
```json
{
  "orderNumber": "etsy_receipt_7890123",
  "filename": "tool-mount-v1.stl",
  "fileURL": "https://zmyczlfuufhngzovkjdh.supabase.co/storage/v1/object/sign/pod3d-stl/abc.stl?token=...",
  "quantity": 1,
  "color": "Black",
  "material": "PLA",
  "shippingAddress": {
    "name": "Jane Smith",
    "address1": "123 Main St",
    "city": "Detroit",
    "province": "MI",
    "zip": "48201",
    "country": "US"
  }
}
```

### Edge Function: `pod3d-etsy-order-webhook`

```typescript
// Receives Etsy order webhook → routes to print farm
// HMAC-SHA256 verify: X-Etsy-Signature header vs body + ETSY_WEBHOOK_SECRET
serve(async (req) => {
  // 1. Verify Etsy HMAC signature (fail fast on bad sig)
  const sig = req.headers.get("X-Etsy-Signature");
  const body = await req.text();
  const expected = await hmacSha256(Deno.env.get("ETSY_WEBHOOK_SECRET")!, body);
  if (sig !== expected) return new Response("Unauthorized", { status: 401 });
  
  const order = JSON.parse(body);
  const receiptId = order.receipt_id;
  
  // 2. Find product in pod3d_product_queue by Etsy listing ID
  const { data: product } = await sb.from("pod3d_product_queue")
    .select("*, pod3d_templates!inner(*)")
    .eq("etsy_listing_id", order.listing_id)
    .single();
  
  // 3. Get signed STL URL from Storage
  const { data: signedUrl } = await sb.storage
    .from("pod3d-stl").createSignedUrl(product.stl_storage_path, 86400);
  
  // 4. Route to preferred farm
  const farm = product.pod3d_templates.preferred_farm;
  if (farm === "shop3d") {
    await routeToShop3D(order, product, signedUrl.signedUrl);
  } else if (farm === "slant3d") {
    await routeToSlant3D(order, product, signedUrl.signedUrl);
  }
  
  // 5. Log to pod3d_orders
  await sb.from("pod3d_orders").insert({ etsy_receipt_id: receiptId, ... });
  
  return new Response("OK", { status: 200 });
});
```

### Full Database Schema

```sql
-- 3D template library
CREATE TABLE pod3d_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scad_source text NOT NULL,           -- OpenSCAD code with $param placeholders
  param_schema jsonb NOT NULL,         -- JSON schema for valid params
  preferred_farm text NOT NULL CHECK (preferred_farm IN ('shop3d','slant3d')),
  default_material text DEFAULT 'PLA',
  default_color text DEFAULT 'black',
  default_infill_pct int DEFAULT 20,
  created_at timestamptz DEFAULT now()
);

-- Product queue (parallel to pod_product_queue for 3D)
CREATE TABLE pod3d_product_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES pod3d_templates(id),
  params jsonb NOT NULL,
  stl_storage_path text,
  mockup_paths text[],
  render_status text DEFAULT 'pending'
    CHECK (render_status IN ('pending','generating_stl','rendering_mockups','ready','failed')),
  etsy_listing_id text,
  etsy_sync_status text DEFAULT 'not_listed'
    CHECK (etsy_sync_status IN ('not_listed','listing','listed','failed')),
  generation_attempts int DEFAULT 0,
  failed_permanently bool DEFAULT false,
  last_error text,
  trace_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order routing
CREATE TABLE pod3d_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etsy_receipt_id text UNIQUE NOT NULL,
  product_queue_id uuid REFERENCES pod3d_product_queue(id),
  farm text NOT NULL CHECK (farm IN ('shop3d','slant3d')),
  farm_order_id text,
  farm_status text,
  shipping_address jsonb NOT NULL,
  sync_attempts int DEFAULT 0,
  last_sync_error text,
  created_at timestamptz DEFAULT now()
);

-- Error log for farm sync failures
CREATE TABLE pod3d_order_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES pod3d_orders(id),
  farm text NOT NULL,
  error_message text,
  request_payload jsonb,
  response_status int,
  created_at timestamptz DEFAULT now()
);

-- RLS: service_role only
ALTER TABLE pod3d_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod3d_product_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod3d_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod3d_order_sync_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON pod3d_templates FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON pod3d_product_queue FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON pod3d_orders FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON pod3d_order_sync_errors FOR ALL TO service_role USING (true);
```

### Seed Templates (copy-paste to add first products)

```sql
INSERT INTO pod3d_templates (name, scad_source, param_schema, preferred_farm, default_material, default_color) VALUES
(
  'Tool Wall Mount - Adjustable Width',
  '// Tool mount with adjustable slot width
   width = slot_width + 10;
   module tool_mount() {
     difference() {
       cube([width, 30, 60]);
       translate([5, -1, 10]) cube([slot_width, 32, 45]);
       translate([width/2, 15, -1]) cylinder(h=15, r=3, $fn=20);
     }
   }
   tool_mount();',
  '{"type":"object","properties":{"slot_width":{"type":"number","minimum":10,"maximum":80,"default":25}}}',
  'slant3d',
  'PLA',
  'black'
),
(
  'AA Battery Dispenser - 8 Cell',
  '// AA battery dispenser
   module dispenser() {
     difference() {
       cube([65, 45, 95]);
       for(i = [0:1]) translate([5 + i*32, 5, -1]) cube([27, 35, 97]);
       translate([65, 5, 20]) rotate([0,90,0]) cube([60, 35, 20]);
     }
   }
   dispenser();',
  '{"type":"object","properties":{"cell_count":{"type":"integer","minimum":4,"maximum":12,"default":8}}}',
  'slant3d',
  'PLA',
  'white'
);
```

### Secrets Required (when ready to deploy physical 3D)

| Secret | Where | Value source |
|---|---|---|
| `FLY_OPENSCAD_WORKER_URL` | Secondary Supabase | Fly.io app URL after `fly deploy` |
| `FLY_OPENSCAD_WORKER_SECRET` | Secondary Supabase + Fly | Generate: `openssl rand -hex 32` |
| `SHOP3D_API_KEY` | Secondary Supabase | Shop3D.io dashboard → API |
| `SLANT3D_API_KEY` | Secondary Supabase | Slant3D.com dashboard → API |
| `ETSY_WEBHOOK_SECRET` | Secondary Supabase | Set when registering Etsy webhook |
| `PRINTIFY_API_KEY` | Already set | — |
| `ETSY_API_KEY` | Already set | — |

---

## Quick Reference: Which 3D Model to Build First?

**Right now (Phase 73): STL digital downloads via `etsy-digital-uploader` extension.**  
Zero new infra. Same pipeline you already have. Ship 5 cookie cutter bundle listings this week.

**Later (when first 3D physical order lands): Deploy Fly.io worker.**  
`fly deploy` from `infra/openscad-worker/`, set secrets, register Etsy webhook, go live.
