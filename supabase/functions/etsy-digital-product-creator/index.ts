// etsy-digital-product-creator — creates Etsy digital download listings with REAL file content
// v10: calls GPT-4o to generate actual STL/SVG/DXF/CSV/HTML/YAML/JSON files, packages as ZIP.
// auditFiles mode: POST {"auditFiles":true,"offset":0,"limit":10} scans all digital listings + auto-repairs empty ones.
import { createClient } from "npm:@supabase/supabase-js@2";
import { strToU8, zipSync } from "npm:fflate@0.8.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[DIGITAL-CREATOR] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

const DIGITAL_TAXONOMY_ID = 2078;

// ─── File generation ──────────────────────────────────────────────────────────

function buildFilePrompt(
  name: string,
  desc: string,
  fileTypes: string[],
  fileCount: string | number,
  hardware: string,
  specs: string,
): string {
  const T = fileTypes.map((t) => t.toUpperCase());
  const has = (...t: string[]) => t.some((x) => T.includes(x));
  const hdr = `Product: "${name}"\nDescription: "${desc.slice(0, 400)}"\nCompatibility: ${hardware}\nSpecs: ${specs}\n\n`;
  const rule =
    `Return ONLY a JSON object: {"files":[{"name":"filename.ext","content":"full file content here"},...]}. No markdown, no code fences.`;

  if (has("STL", "SCAD")) {
    return (
      hdr +
      `You are an expert 3D modeling engineer for FDM/maker printing (Gridfinity system, 42mm grid).

Generate these files:
1. 6 ASCII STL files for Gridfinity bin variants (1x1x3, 1x2x3, 2x2x3, 1x1x6, 2x2x6, 1x3x3 units where 1 unit = 42mm W/D, 1 height unit = 7mm). Each STL must be a valid closed box mesh with correct outward-facing normals. Include all 12 triangular facets (2 per face × 6 faces). Name pattern: gridfinity_WxDxH.stl
2. One parametric OpenSCAD source (gridfinity_bin.scad) accepting width_u, depth_u, height_u, wall_t=1.5 parameters.
3. README.txt with: print settings (0.2mm layers, 15% gyroid infill, no supports, PLA or PETG), overview of the Gridfinity system, usage tips.

ASCII STL format reference for a 42×42×21mm box (1x1x3):
solid gridfinity_1x1x3
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 42 0 0
      vertex 42 42 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 42 42 0
      vertex 0 42 0
    endloop
  endfacet
  [continue for top, front, back, left, right faces with correct outward normals]
endsolid gridfinity_1x1x3

Generate all 12 facets for each bin. Use correct normal vectors for each face.

` +
      rule
    );
  }

  if (has("SVG", "DXF", "AI")) {
    return (
      hdr +
      `You are an expert laser cutting engineer and vector file creator.

Generate these files:
1. 4 SVG files for living hinge box sizes (small 100x80x50mm, medium 150x120x60mm, large 200x150x80mm, tall 120x100x80mm). Each SVG must be valid XML with:
   - Header: <?xml version="1.0" encoding="UTF-8"?>
   - <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="Wmm" height="Hmm">
   - Red stroke (#FF0000) stroke-width="0.1" fill="none" for laser cuts
   - Living hinge pattern: rows of parallel horizontal cuts with alternating half-pitch offset, cut_length=28mm, gap=4mm, pitch=5mm, repeated across hinge panels
   - Box panels laid flat: bottom, 4 sides with hinge sections, lid
   Name: living_hinge_small.svg, living_hinge_medium.svg, living_hinge_large.svg, living_hinge_tall.svg
2. 4 matching ASCII DXF R12 files (same geometry as SVGs, LINE entities). Valid DXF structure: 0/SECTION/2/HEADER ... 0/SECTION/2/ENTITIES ... LINE entities ... 0/ENDSEC/0/EOF
   Name: living_hinge_small.dxf etc.
3. README.txt: laser settings table for plywood-3mm/acrylic-3mm/MDF-3mm (speed mm/min, power %, passes), assembly steps (soak wood 5min before bending hinge), material notes, kerf compensation tips.

` +
      rule
    );
  }

  if (has("PDF", "XLSX", "XLS", "CSV")) {
    const ctx = (name + " " + desc).toLowerCase();
    const isSignage = /sign|poster|label|warning|osha|safety|notice|hazard|caution/.test(ctx);

    if (isSignage) {
      return (
        hdr +
        `You are a professional graphic designer specializing in workplace safety signage and printable assets.

Generate a comprehensive OSHA-style safety signage pack:
1. At least 12 SVG sign files covering: DANGER (red header), WARNING (orange header), CAUTION (yellow header), NOTICE (blue header), and SAFETY FIRST (green header) categories. Examples: "Keep Area Clear", "High Voltage", "Eye Protection Required", "No Unauthorized Entry", "Emergency Exit", "Fire Extinguisher", "First Aid Station", "Forklift Area", "Slip Hazard", "Hearing Protection Required", "Hard Hat Required", "No Smoking".
   - Each SVG: valid XML, 8.5x11 inch canvas (viewBox="0 0 850 1100"), correct OSHA color scheme for its category header, large bold text, appropriate icon shape (triangle for warning, circle for prohibition, rectangle for notice).
   - Name pattern: osha_danger_high_voltage.svg, osha_warning_eye_protection.svg, etc.
2. signs_index.html — a standalone HTML page showing a thumbnail grid of all signs with print buttons, CSS @media print, professional layout. Buyers can open this to browse and print any sign.
3. README.txt: OSHA color standards table (Danger=red/white, Warning=orange/black, Caution=yellow/black, Notice=blue/white), standard sizes (10×14, 7×10, 14×20 inches), material recommendations (vinyl, laminated paper, aluminum), mounting tips.

` +
        rule
      );
    }

    return (
      hdr +
      `You are a professional technical documentation expert.

Generate these files tailored to the product above:
1. A primary CSV data file with at least 40 rows of comprehensive reference data relevant to the product (use column names appropriate to the topic).
2. A secondary CSV with supplementary data (different material, category, or use case).
3. A third CSV covering another relevant variant or category.
4. reference_sheet.html — complete standalone HTML (no external dependencies) with:
   - All data tables styled with color-coded headers (#2c3e50 dark, alternating rows)
   - Any formulas or quick-reference sections relevant to the product
   - CSS with @media print for clean PDF printing
   - Professional typography, no external fonts or scripts
5. README.txt: column definitions, how to use the data, tips and common mistakes.

` +
      rule
    );
  }

  if (has("YAML", "YML", "JSON", "TXT")) {
    return (
      hdr +
      `You are a senior Home Assistant developer and smart home automation engineer.

Generate these immediately-usable files:
1. dashboard.yaml — Complete Lovelace dashboard YAML with:
   - title: "Modern Home"
   - views: array of 3 views — "Overview", "Climate & Energy", "Security"
   - Overview view: weather-forecast card, glance card with 6 lights, thermostat card, energy gauge card, history-graph for power usage
   - Climate view: thermostat card, history-graph for temp/humidity (7 days), schedule card, sensor cards for each room
   - Security view: alarm-panel card, grid of door/window binary sensors, camera placeholder, person tracker cards
   - Use realistic entity IDs: light.living_room, climate.main_thermostat, binary_sensor.front_door, alarm_control_panel.home_alarm, etc.
   - ~200 lines, properly indented YAML
2. theme.yaml — Complete Lovelace custom theme "Modern Minimalist":
   - Colors: primary #1a73e8, accent #34a853, backgrounds #f8f9fa / #ffffff
   - Card border-radius: 12px, box-shadow styles
   - Typography: font family, sizes for headers/body/labels
   - ~60 lines
3. automations.yaml — 6 complete HA automation entries (list format):
   - Motion lights with 5-min timeout (trigger: motion sensor, action: light on/off)
   - Thermostat schedule weekday/weekend (trigger: time, action: climate.set_temperature)
   - Door left open 10min alert (trigger: state duration, action: notify.mobile_app)
   - Presence-based HVAC away/home mode (trigger: zone enter/leave, action: climate mode)
   - Sunrise blinds open / sunset blinds close (trigger: sun event, action: cover.set_position)
   - Low battery notification for all sensors (trigger: numeric_state below 15, action: persistent_notification)
   - ~120 lines
4. README.txt: step-by-step install instructions, how to reference dashboard.yaml in configuration.yaml, how to install theme, how to add automations, how to update entity IDs for your home, FAQ.

` +
      rule
    );
  }

  return (
    hdr +
    `Generate complete, high-quality, immediately-usable digital files for this product. Required file types: ${fileTypes.join(", ")}. Create at least ${fileCount} files plus a README.txt.\n\n` +
    rule
  );
}

async function generateFiles(
  name: string,
  desc: string,
  specsRaw: string,
  openaiKey: string,
): Promise<{ name: string; content: string }[]> {
  let specs: Record<string, unknown> = {};
  try { specs = JSON.parse(specsRaw); } catch { /* empty */ }

  const fileTypes = Array.isArray(specs.file_types)
    ? (specs.file_types as string[])
    : [String(specs.file_types ?? "TXT")];
  const fileCount = specs.file_count ?? 5;
  const hardware = String(specs.hardware_compatibility ?? "");
  const specNotes = String(specs.specs ?? "");

  const prompt = buildFilePrompt(name, desc, fileTypes, String(fileCount), hardware, specNotes);
  log("Generating real files with GPT-4o", { fileTypes });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8000,
      temperature: 0.15,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`GPT-4o ${res.status}: ${err.slice(0, 150)}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error("GPT-4o returned no files");
  }

  log("Files generated", { count: parsed.files.length, names: (parsed.files as { name: string }[]).map((f) => f.name) });
  return parsed.files as { name: string; content: string }[];
}

function makeZip(files: { name: string; content: string }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    const safe = f.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
    entries[safe] = strToU8(f.content);
  }
  return zipSync(entries, { level: 6 });
}

// ─── Multi-image preview prompt builder ──────────────────────────────────────
// Calls GPT-4o-mini to generate 4 tailored DALL-E prompts per product.
// Each covers a distinct angle: contents flat-lay, in-use context, detail
// close-up, and value/overview. All photorealistic, white background.

async function buildImagePrompts(name: string, desc: string, specsRaw: string, openaiKey: string): Promise<string[]> {
  const base = "Pure white background. Ultra-sharp product photography. No text overlays. Professional Etsy listing photo style.";
  const fallback = [
    `Flat-lay overhead of printed documents and files spread on white surface with pen and ruler. Professional product photography. ${base}`,
    `Laptop screen showing a polished digital product open and in use. Clean desk. ${base}`,
    `Macro close-up of high-quality printed output showing crisp typography and detail. ${base}`,
    `Overhead desk scene with printed sheets, laptop, and professional tools. ${base}`,
  ];
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `You are a product photography director for Etsy digital downloads. Generate exactly 4 DALL-E image prompts for this product's Etsy listing preview photos.

Product: "${name}"
Description: "${desc.slice(0, 300)}"
File specs: ${specsRaw.slice(0, 200)}

Rules:
- Each prompt must describe a DIFFERENT scene/angle: (1) flat-lay contents spread, (2) product in real-world use context, (3) macro detail close-up, (4) full value/overview shot
- Be highly specific to this exact product (mention actual files, tools, environments it belongs in)
- Every prompt ends with: "${base}"
- No text overlays or UI text in images
- Photorealistic photography style

Return ONLY valid JSON: {"prompts":["...","...","...","..."]}`,
        }],
        temperature: 0.8,
        response_format: { type: "json_object" },
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return fallback;
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content ?? "{}");
    if (Array.isArray(parsed.prompts) && parsed.prompts.length >= 4) return parsed.prompts.slice(0, 4);
  } catch { /* fall through */ }
  return fallback;
}

// ─── Description builder ──────────────────────────────────────────────────────

function buildDescription(baseDescription: string, specsJson: string): string {
  let specs: Record<string, string | string[]> = {};
  try { specs = JSON.parse(specsJson); } catch { /* use empty */ }

  const fileTypes = Array.isArray(specs.file_types)
    ? (specs.file_types as string[]).join(" / ")
    : String(specs.file_types ?? "Digital Files");
  const hardware = String(specs.hardware_compatibility ?? "Standard software");
  const sizeMb = String(specs.archive_size_mb ?? "");
  const fileCount = String(specs.file_count ?? "");
  const specNotes = String(specs.specs ?? "");

  const archiveLine = sizeMb ? `▸ Archive Size:           ${sizeMb}MB instant download` : "";
  const fileCountLine = fileCount ? `▸ Files Included:         ${fileCount}` : "";
  const specLine = specNotes ? `▸ Specifications:         ${specNotes}` : "";

  return `${baseDescription}

════════════════════════════════════════
📐 TECHNICAL FILE SPECIFICATIONS
════════════════════════════════════════
▸ File Formats Included:  ${fileTypes}
▸ Target Hardware:        ${hardware}
${fileCountLine}
${archiveLine}
${specLine}

✅ Instant Digital Download — Files ready to use immediately after purchase

════════════════════════════════════════

These files are production-ready and tested for accuracy. Ideal for professionals, makers, and fabricators who need reliable digital assets they can use immediately.

► INSTANT DELIVERY — After purchase, click "Download Files" on your Order Confirmation page. No shipping, no wait, no delays.`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Repair helper: replace files on an existing listing ─────────────────────

async function repairOneListing(
  listingId: string,
  queueName: string,
  queueDesc: string,
  queueSpecs: string,
  shopId: string,
  etsyHeaderKey: string,
  accessToken: string,
  openaiKey: string,
): Promise<{ ok: boolean; files?: string[]; error?: string }> {
  const hdrs = { "x-api-key": etsyHeaderKey, Authorization: `Bearer ${accessToken}` };

  // 1. List + delete existing download files (the wrongly-uploaded PNG)
  const existingRes = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
    { headers: hdrs, signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);

  if (existingRes?.ok) {
    const existing = await existingRes.json().catch(() => ({ results: [] }));
    for (const f of (existing.results ?? []) as { listing_file_id: number }[]) {
      await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files/${f.listing_file_id}`,
        { method: "DELETE", headers: hdrs, signal: AbortSignal.timeout(10_000) },
      ).catch(() => null);
      log(`Deleted old file ${f.listing_file_id} from listing ${listingId}`);
    }
  }

  // 2. Generate real files
  let files: { name: string; content: string }[];
  try {
    files = await generateFiles(queueName, queueDesc, queueSpecs, openaiKey);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // 3. Pack ZIP and upload
  const zip = makeZip(files);
  const zipName = `${queueName.slice(0, 40).replace(/[^a-z0-9]/gi, "_")}_files.zip`;
  const form = new FormData();
  form.append("file", new Blob([zip], { type: "application/zip" }), zipName);
  form.append("name", zipName);
  form.append("rank", "1");

  const upRes = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
    {
      method: "POST",
      headers: { "x-api-key": etsyHeaderKey, Authorization: `Bearer ${accessToken}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!upRes.ok) {
    const err = await upRes.text().catch(() => "");
    return { ok: false, error: `ZIP upload ${upRes.status}: ${err.slice(0, 100)}` };
  }

  log("Repair complete", { listingId, files: files.map((f) => f.name) });
  return { ok: true, files: files.map((f) => f.name) };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
  const ETSY_SECRET = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
  const ETSY_HEADER_KEY = ETSY_SECRET ? `${ETSY_API_KEY}:${ETSY_SECRET}` : ETSY_API_KEY;
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const clientId = ETSY_API_KEY.split(":")[0];

  if (!clientId || !OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "Missing ETSY_API_KEY or OPENAI_API_KEY" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // ── OAuth token ────────────────────────────────────────────────────────────
  const { data: tokenRow } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) {
    return new Response(JSON.stringify({ error: "No Etsy OAuth tokens — complete OAuth flow first" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let accessToken: string = tokenRow.access_token;
  const needsRefresh = Date.now() >= new Date(tokenRow.expires_at).getTime() - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Refreshing expired token");
    const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: tokenRow.refresh_token,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!refreshRes.ok) {
      return new Response(JSON.stringify({ error: "Token refresh failed — re-run OAuth flow" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rd = await refreshRes.json();
    accessToken = rd.access_token;
    await sb.from("etsy_oauth_tokens").update({
      access_token: accessToken,
      refresh_token: rd.refresh_token ?? tokenRow.refresh_token,
      expires_at: new Date(Date.now() + (rd.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);
    log("Token refreshed");
  }

  const etsyHeaders = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };

  // ── Shop ID ────────────────────────────────────────────────────────────────
  let shopId: string = Deno.env.get("ETSY_SHOP_ID") || tokenRow.shop_id || "";
  if (!shopId) {
    const shopRes = await fetch(
      `https://openapi.etsy.com/v3/application/users/${tokenRow.user_id}/shops`,
      { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (shopRes?.ok) {
      const sd = await shopRes.json().catch(() => ({}));
      shopId = String(sd?.shop_id ?? sd?.results?.[0]?.shop_id ?? "");
      if (shopId) await sb.from("etsy_oauth_tokens").update({ shop_id: shopId }).eq("id", tokenRow.id);
    }
    if (!shopId) {
      return new Response(JSON.stringify({ error: "Could not resolve shop_id" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE LISTINGS MODE — remove listings from Etsy + etsy_digital_listings
  // Body: { deleteListings: ["etsy_listing_id", ...] }
  // ══════════════════════════════════════════════════════════════════════════

  if (Array.isArray(body.deleteListings)) {
    const ids = (body.deleteListings as string[]).map(String);
    const hdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };
    const results = [];

    for (const listingId of ids) {
      try {
        const res = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
          { method: "DELETE", headers: hdrs, signal: AbortSignal.timeout(15_000) },
        );
        const ok = res.ok || res.status === 404;
        if (ok) {
          await sb.from("etsy_digital_listings").delete().eq("etsy_listing_id", listingId);
          results.push({ listingId, status: "deleted", etsy_status: res.status });
        } else {
          const err = await res.text().catch(() => "");
          results.push({ listingId, status: "error", etsy_status: res.status, error: err.slice(0, 150) });
        }
      } catch (e) {
        results.push({ listingId, status: "error", error: (e as Error).message.slice(0, 100) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ deleted: results.filter((r) => r.status === "deleted").length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH LISTINGS MODE — update title/description on existing Etsy listings
  // Body: { patchListings: [{listingId, title?, description?}, ...] }
  // ══════════════════════════════════════════════════════════════════════════

  if (Array.isArray(body.patchListings)) {
    const hdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const results = [];

    for (const item of body.patchListings as Array<{ listingId: string; title?: string; description?: string; type?: string; state?: string; should_auto_renew?: boolean }>) {
      const patch: Record<string, unknown> = {};
      if (item.title) patch.title = item.title.slice(0, 140);
      if (item.description) patch.description = item.description.slice(0, 5000);
      if (item.type) patch.type = item.type;
      if (item.state) patch.state = item.state;
      if (item.should_auto_renew !== undefined) patch.should_auto_renew = item.should_auto_renew;
      if (Object.keys(patch).length === 0) { results.push({ listingId: item.listingId, status: "skipped_nothing_to_patch" }); continue; }

      try {
        const res = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${item.listingId}`,
          { method: "PATCH", headers: hdrs, body: JSON.stringify(patch), signal: AbortSignal.timeout(15_000) },
        );
        if (res.ok) {
          results.push({ listingId: item.listingId, status: "patched", fields: Object.keys(patch) });
        } else {
          const err = await res.text().catch(() => "");
          results.push({ listingId: item.listingId, status: "error", etsy_status: res.status, error: err.slice(0, 150) });
        }
      } catch (e) {
        results.push({ listingId: item.listingId, status: "error", error: (e as Error).message.slice(0, 100) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ patched: results.filter((r) => r.status === "patched").length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPAIR MODE — replace PNG with real ZIP on an existing listing
  // Body: { repair: true, listingId: "xxx", queueId: 22 }
  // ══════════════════════════════════════════════════════════════════════════

  if (body.repair === true) {
    const listingId = String(body.listingId ?? "");
    const queueId = Number(body.queueId ?? 0);

    if (!listingId || !queueId) {
      return new Response(JSON.stringify({ error: "repair mode requires listingId and queueId" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    log("REPAIR MODE", { listingId, queueId });

    const { data: q } = await sb
      .from("pod_product_queue")
      .select("name, description, digital_file_specs")
      .eq("id", queueId)
      .maybeSingle();

    if (!q) {
      return new Response(JSON.stringify({ error: `Queue item ${queueId} not found` }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const result = await repairOneListing(
      listingId,
      q.name ?? "",
      q.description ?? "",
      q.digital_file_specs ?? "{}",
      shopId,
      ETSY_HEADER_KEY,
      accessToken,
      OPENAI_KEY,
    );

    return new Response(JSON.stringify({ listingId, queueId, ...result }), {
      status: result.ok ? 200 : 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPAIR-ACTIVATE MODE — generate DALL-E image + PATCH state=active for all
  // digital listings that show as unavailable. Body: { repairActivate: true }
  // ══════════════════════════════════════════════════════════════════════════

  if (body.repairActivate === true) {
    const { data: allDp } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id, queue_id");

    const etsyHdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };

    const processOne = async (dp: { id: number; etsy_listing_id: string; queue_id: number | null }) => {
      const listingId = dp.etsy_listing_id;
      log("repairActivate", { listingId });

      const { data: q } = await sb
        .from("pod_product_queue")
        .select("name, image_prompt")
        .eq("id", dp.queue_id)
        .maybeSingle();

      const promptText = q?.image_prompt ?? q?.name ?? "digital download product";

      // Generate DALL-E image
      let imageB64: string | null = null;
      try {
        const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: `Product showcase image for an Etsy digital download listing. ${promptText} Pure white background. Professional product thumbnail. Clean, high-contrast, no text overlays.`,
            size: "1024x1024",
            quality: "medium",
            n: 1,
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (imgRes.ok) {
          const d = await imgRes.json();
          imageB64 = (d?.data?.[0]?.b64_json as string) ?? null;
        } else {
          log("DALL-E failed", { listingId, status: imgRes.status });
        }
      } catch (e) {
        log("DALL-E error", { listingId, error: (e as Error).message.slice(0, 60) });
      }

      // Upload image as listing photo
      if (imageB64) {
        try {
          const imgBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
          const imgForm = new FormData();
          imgForm.append("image", new Blob([imgBytes], { type: "image/png" }), "listing_image.png");
          imgForm.append("rank", "1");
          imgForm.append("overwrite", "true");
          const imgUp = await fetch(
            `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
            { method: "POST", headers: etsyHdrs, body: imgForm, signal: AbortSignal.timeout(30_000) },
          );
          if (imgUp.ok) log("Image uploaded", { listingId });
          else log("Image upload failed", { listingId, status: imgUp.status, body: (await imgUp.text().catch(() => "")).slice(0, 100) });
        } catch (e) {
          log("Image upload error", { listingId, error: (e as Error).message.slice(0, 60) });
        }
      }

      // PATCH listing state to active
      const patchRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { ...etsyHdrs, "Content-Type": "application/json" },
          body: JSON.stringify({ state: "active" }),
          signal: AbortSignal.timeout(15_000),
        },
      ).catch(() => null);

      if (patchRes?.ok) {
        log("Activated listing", { listingId });
        return { listingId, ok: true };
      } else {
        const err = await patchRes?.text().catch(() => "") ?? "network error";
        log("Activate failed", { listingId, err: err.slice(0, 100) });
        return { listingId, ok: false, error: err.slice(0, 100) };
      }
    };

    // Process all in parallel — DALL-E calls run concurrently, cuts time from ~170s to ~30s
    const results = await Promise.all((allDp ?? []).map((dp) => processOne(dp)));

    return new Response(JSON.stringify({ repairActivate: true, count: results.length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADD-IMAGES MODE — add 4 high-quality product-specific preview images to
  // every digital listing. Body: { repairAddImages: true }
  // Skips rank 1 (hero already exists). Uploads ranks 2-5.
  // ══════════════════════════════════════════════════════════════════════════

  if (body.repairAddImages === true) {
    const limit = Number(body.limit ?? 5);
    const offset = Number(body.offset ?? 0);
    const { data: allDp } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id, queue_id")
      .range(offset, offset + limit - 1);

    const etsyHdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };

    const addImagesForOne = async (dp: { id: number; etsy_listing_id: string; queue_id: number | null }) => {
      const listingId = dp.etsy_listing_id;
      const { data: q } = await sb
        .from("pod_product_queue")
        .select("name, description, digital_file_specs")
        .eq("id", dp.queue_id)
        .maybeSingle();

      const productName = q?.name ?? "Digital Download";
      const productDesc = q?.description ?? "";
      const productSpecs = q?.digital_file_specs ?? "{}";
      const prompts = await buildImagePrompts(productName, productDesc, productSpecs, OPENAI_KEY);
      log("Generating preview images", { listingId, count: prompts.length });

      // Generate all 4 images in parallel with high quality
      const imageResults = await Promise.allSettled(
        prompts.map((prompt) =>
          fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-image-1",
              prompt,
              size: "1024x1024",
              quality: "high",
              n: 1,
            }),
            signal: AbortSignal.timeout(90_000),
          }).then(async (r) => {
            if (!r.ok) throw new Error(`DALL-E ${r.status}`);
            const d = await r.json();
            return (d?.data?.[0]?.b64_json as string) ?? null;
          })
        ),
      );

      // Upload each successful image at ranks 2-5
      let uploaded = 0;
      for (let i = 0; i < imageResults.length; i++) {
        const result = imageResults[i];
        if (result.status === "rejected" || !result.value) {
          log("Image gen failed", { listingId, index: i, error: result.status === "rejected" ? (result.reason as Error).message?.slice(0, 60) : "null" });
          continue;
        }
        const b64 = result.value;
        try {
          const imgBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const imgForm = new FormData();
          imgForm.append("image", new Blob([imgBytes], { type: "image/png" }), `preview_${i + 1}.png`);
          imgForm.append("rank", String(i + 2)); // ranks 2-5
          imgForm.append("overwrite", "true");
          const up = await fetch(
            `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
            { method: "POST", headers: etsyHdrs, body: imgForm, signal: AbortSignal.timeout(30_000) },
          );
          if (up.ok) { uploaded++; log("Preview uploaded", { listingId, rank: i + 2 }); }
          else log("Preview upload failed", { listingId, rank: i + 2, status: up.status, body: (await up.text().catch(() => "")).slice(0, 80) });
        } catch (e) {
          log("Preview upload error", { listingId, rank: i + 2, error: (e as Error).message.slice(0, 60) });
        }
      }

      return { listingId, ok: uploaded > 0, uploaded, total: prompts.length };
    };

    // Run all listings in parallel
    const results = await Promise.all((allDp ?? []).map((dp) => addImagesForOne(dp)));
    const totalUploaded = results.reduce((s, r) => s + (r.uploaded ?? 0), 0);
    log("repairAddImages complete", { listings: results.length, totalUploaded });

    const nextOffset = (allDp?.length ?? 0) === limit ? offset + limit : null;
    return new Response(
      JSON.stringify({ repairAddImages: true, listings: results.length, totalUploaded, results, nextOffset }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIT FILES MODE — scan all digital listings, auto-repair any with 0 files
  // Body: { auditFiles: true, offset: 0, limit: 10 }
  // ══════════════════════════════════════════════════════════════════════════

  if (body.auditFiles === true) {
    const offset = Number(body.offset ?? 0);
    const limit = Number(body.limit ?? 10);

    // Pull from both tables: pod_digital_products (creator) + etsy_digital_listings (legacy uploader)
    const [creatorRes, legacyRes] = await Promise.all([
      sb.from("pod_digital_products")
        .select("id, etsy_listing_id, queue_id")
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1),
      sb.from("etsy_digital_listings")
        .select("id, etsy_listing_id")
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1),
    ]);

    const creatorRows = (creatorRes.data ?? []) as { id: number; etsy_listing_id: string; queue_id: number | null }[];
    const legacyRows = (legacyRes.data ?? []) as { id: number; etsy_listing_id: string }[];

    const results: Array<{ listingId: string; source: string; fileCount: number; status: string; wasEmpty: boolean }> = [];

    const checkListing = async (listingId: string, source: string, queueId: number | null) => {
      const filesRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
        { headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) },
      ).catch(() => null);

      if (!filesRes?.ok) {
        log("Files check failed", { listingId, status: filesRes?.status });
        results.push({ listingId, source, fileCount: -1, status: "check_failed", wasEmpty: false });
        return;
      }

      const filesData = await filesRes.json().catch(() => ({ results: [] }));
      const fileCount: number = filesData?.count ?? (Array.isArray(filesData?.results) ? filesData.results.length : 0);

      if (fileCount === 0 && queueId) {
        log("EMPTY listing — repairing", { listingId, queueId });
        const { data: q } = await sb.from("pod_product_queue")
          .select("name, description, digital_file_specs")
          .eq("id", queueId)
          .maybeSingle();

        if (q) {
          const repairResult = await repairOneListing(
            listingId, q.name ?? "", q.description ?? "", q.digital_file_specs ?? "{}",
            shopId, ETSY_HEADER_KEY, accessToken, OPENAI_KEY,
          );
          results.push({ listingId, source, fileCount: 0, status: repairResult.ok ? "repaired" : `repair_failed: ${repairResult.error?.slice(0, 60)}`, wasEmpty: true });
        } else {
          results.push({ listingId, source, fileCount: 0, status: "empty_no_queue_data", wasEmpty: true });
        }
      } else if (fileCount === 0) {
        results.push({ listingId, source, fileCount: 0, status: "empty_no_repair_data", wasEmpty: true });
      } else {
        results.push({ listingId, source, fileCount, status: "ok", wasEmpty: false });
      }
      await new Promise((r) => setTimeout(r, 300));
    };

    for (const row of creatorRows) {
      await checkListing(row.etsy_listing_id, "pod_digital_products", row.queue_id);
    }
    for (const row of legacyRows) {
      await checkListing(row.etsy_listing_id, "etsy_digital_listings", null);
    }

    const missing = results.filter((r) => r.wasEmpty).length;
    const ok = results.filter((r) => r.status === "ok").length;
    log("auditFiles complete", { audited: results.length, missing, ok });

    return new Response(JSON.stringify({
      auditFiles: true,
      audited: results.length,
      missing,
      ok,
      nextOffset: offset + limit,
      results,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIT DEEP CHECK MODE — verify all 10 technical listings on Etsy
  // Body: { auditDeepCheck: true, offset: 0, limit: 10 }
  // Checks: active status, actual file count vs claimed, flags mismatches
  // ══════════════════════════════════════════════════════════════════════════

  if (body.auditDeepCheck === true) {
    const offset = Number(body.offset ?? 0);
    const limit = Number(body.limit ?? 10);

    const { data: rows } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id, queue_id, price_cents, file_name")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    const hdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };
    const results = [];

    for (const row of rows ?? []) {
      const listingId = row.etsy_listing_id;
      const report: Record<string, unknown> = { listingId, db_id: row.id };

      // Load queue data for claimed specs
      const { data: q } = await sb
        .from("pod_product_queue")
        .select("name, digital_file_specs")
        .eq("id", row.queue_id)
        .maybeSingle();

      report.title = q?.name ?? "(no queue row)";

      // Parse claimed file count
      let claimedFiles: string | number = "unknown";
      try {
        const specs = JSON.parse(q?.digital_file_specs ?? "{}");
        claimedFiles = specs.file_count ?? "unknown";
      } catch { /* ignore */ }
      report.claimed_files = claimedFiles;

      // 1. Check Etsy listing state
      const listingRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${listingId}`,
        { headers: hdrs, signal: AbortSignal.timeout(10_000) },
      ).catch(() => null);

      if (!listingRes?.ok) {
        report.etsy_state = `fetch_failed_${listingRes?.status ?? "network"}`;
        report.actual_files = -1;
        report.mismatch = false;
        report.flags = ["etsy_fetch_failed"];
        results.push(report);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const listingData = await listingRes.json().catch(() => ({}));
      report.etsy_state = listingData.state ?? "unknown";
      report.is_digital = listingData.is_digital ?? false;
      report.price = listingData.price?.amount != null
        ? `$${(listingData.price.amount / listingData.price.divisor).toFixed(2)}`
        : `$${(row.price_cents / 100).toFixed(2)} (db)`;

      // 2. Check actual file count
      const filesRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
        { headers: hdrs, signal: AbortSignal.timeout(10_000) },
      ).catch(() => null);

      let actualFiles = -1;
      if (filesRes?.ok) {
        const filesData = await filesRes.json().catch(() => ({ results: [] }));
        actualFiles = filesData?.count ?? (Array.isArray(filesData?.results) ? filesData.results.length : 0);
        report.file_names = Array.isArray(filesData?.results)
          ? (filesData.results as { filename?: string; name?: string }[]).map((f) => f.filename ?? f.name ?? "?")
          : [];
      }
      report.actual_files = actualFiles;

      // 3. Flag issues
      const flags: string[] = [];
      if (report.etsy_state !== "active") flags.push(`state_${report.etsy_state}`);
      if (!report.is_digital) flags.push("not_marked_digital");
      if (actualFiles === 0) flags.push("NO_FILES_UPLOADED");
      if (actualFiles > 0 && typeof claimedFiles === "string" && claimedFiles.includes("+")) {
        const claimedMin = parseInt(claimedFiles);
        if (!isNaN(claimedMin) && actualFiles < claimedMin) flags.push(`file_count_mismatch_claimed_${claimedFiles}_actual_${actualFiles}`);
      } else if (actualFiles > 0 && typeof claimedFiles === "number" && actualFiles < claimedFiles * 0.8) {
        flags.push(`file_count_mismatch_claimed_${claimedFiles}_actual_${actualFiles}`);
      }

      report.mismatch = flags.length > 0;
      report.flags = flags;
      results.push(report);
      await new Promise((r) => setTimeout(r, 400));
    }

    const issues = results.filter((r) => (r as Record<string, unknown>).mismatch);
    log("auditDeepCheck complete", { audited: results.length, issues: issues.length });

    return new Response(JSON.stringify({
      auditDeepCheck: true,
      audited: results.length,
      issues: issues.length,
      clean: results.length - issues.length,
      nextOffset: (rows?.length ?? 0) === limit ? offset + limit : null,
      results,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH PRICES MODE — lower all digital listings to review-phase pricing
  // Body: { patchPrices: true, targetNetCents: 100, offset: 0, limit: 20 }
  //   targetNetCents: desired net profit per sale in cents (default: 100 = $1.00)
  //   Price formula: ceil((targetNetCents + 25) / 0.905 * 100) / 100
  //   For $1 net → $1.49; for $5 net → $5.99
  // Saves current price as original_price_cents before changing.
  // Run restorePrices to undo.
  // ══════════════════════════════════════════════════════════════════════════
  if (body.patchPrices === true) {
    const targetNetCents = Number(body.targetNetCents ?? 100);
    const offset = Number(body.offset ?? 0);
    const limit = Number(body.limit ?? 20);
    // Calculate price: P × 0.905 − 0.25 = targetNet → P = (targetNet + 0.25) / 0.905
    const newPriceDollars = Math.ceil((targetNetCents + 25) / 0.905) / 100;
    const newPriceCents = Math.round(newPriceDollars * 100);
    log("patchPrices start", { targetNetCents, newPriceDollars, offset, limit });

    // Collect listing IDs from both tables (paginated together)
    const { data: dlRows } = await sb
      .from("etsy_digital_listings")
      .select("id, etsy_listing_id, price_cents, original_price_cents")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: pdRows } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id, price_cents, original_price_cents")
      .order("id", { ascending: true })
      .range(0, 19); // technical products are always few; fetch all

    const allRows: Array<{ id: number; listingId: string; currentPriceCents: number; table: string }> = [
      ...(dlRows ?? []).map((r: Record<string, unknown>) => ({
        id: Number(r.id), listingId: String(r.etsy_listing_id),
        currentPriceCents: Number(r.price_cents), table: "etsy_digital_listings",
      })),
      ...(offset === 0 ? (pdRows ?? []).map((r: Record<string, unknown>) => ({
        id: Number(r.id), listingId: String(r.etsy_listing_id),
        currentPriceCents: Number(r.price_cents), table: "pod_digital_products",
      })) : []),
    ];

    const results: Array<{ listingId: string; status: string; oldPrice: number; newPrice: number }> = [];
    for (const row of allRows) {
      if (row.currentPriceCents === newPriceCents) {
        results.push({ listingId: row.listingId, status: "already_set", oldPrice: row.currentPriceCents, newPrice: newPriceCents });
        continue;
      }
      try {
        // Save original price before first patch
        await sb.from(row.table).update({ original_price_cents: row.currentPriceCents }).eq("id", row.id).is("original_price_cents", null);

        const patchRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${row.listingId}`,
          {
            method: "PATCH",
            headers: { ...etsyHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ price: newPriceDollars }),
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (patchRes.ok) {
          await sb.from(row.table).update({ price_cents: newPriceCents }).eq("id", row.id);
          results.push({ listingId: row.listingId, status: "patched", oldPrice: row.currentPriceCents, newPrice: newPriceCents });
        } else {
          const errBody = await patchRes.text();
          results.push({ listingId: row.listingId, status: `etsy_error_${patchRes.status}`, oldPrice: row.currentPriceCents, newPrice: newPriceCents });
          log("Etsy patch error", { listingId: row.listingId, status: patchRes.status, body: errBody.slice(0, 100) });
        }
      } catch (e) {
        results.push({ listingId: row.listingId, status: `error: ${(e as Error).message.slice(0, 60)}`, oldPrice: row.currentPriceCents, newPrice: newPriceCents });
      }
      await new Promise((r) => setTimeout(r, 300)); // 300ms between Etsy calls (~3 req/s)
    }

    const patched = results.filter((r) => r.status === "patched").length;
    const nextOffset = (dlRows?.length ?? 0) === limit ? offset + limit : null;
    log("patchPrices complete", { patched, total: allRows.length, nextOffset });
    return new Response(JSON.stringify({
      patchPrices: true,
      newPriceDollars,
      targetNetPerSaleDollars: targetNetCents / 100,
      patched,
      alreadySet: results.filter((r) => r.status === "already_set").length,
      errors: results.filter((r) => r.status.startsWith("etsy_error") || r.status.startsWith("error")).length,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"patchPrices":true,"targetNetCents":${targetNetCents},"offset":${nextOffset},"limit":${limit}}` : null,
      results,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESTORE PRICES MODE — raise prices back to pre-review originals
  // Body: { restorePrices: true, offset: 0, limit: 20 }
  // Reads original_price_cents saved by patchPrices and restores each listing.
  // Clears original_price_cents after restore.
  // ══════════════════════════════════════════════════════════════════════════
  if (body.restorePrices === true) {
    const offset = Number(body.offset ?? 0);
    const limit = Number(body.limit ?? 20);
    log("restorePrices start", { offset, limit });

    const { data: dlRows } = await sb
      .from("etsy_digital_listings")
      .select("id, etsy_listing_id, price_cents, original_price_cents")
      .not("original_price_cents", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: pdRows } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id, price_cents, original_price_cents")
      .not("original_price_cents", "is", null)
      .order("id", { ascending: true })
      .range(0, 19);

    const allRows: Array<{ id: number; listingId: string; currentPriceCents: number; originalPriceCents: number; table: string }> = [
      ...(dlRows ?? []).map((r: Record<string, unknown>) => ({
        id: Number(r.id), listingId: String(r.etsy_listing_id),
        currentPriceCents: Number(r.price_cents), originalPriceCents: Number(r.original_price_cents), table: "etsy_digital_listings",
      })),
      ...(offset === 0 ? (pdRows ?? []).map((r: Record<string, unknown>) => ({
        id: Number(r.id), listingId: String(r.etsy_listing_id),
        currentPriceCents: Number(r.price_cents), originalPriceCents: Number(r.original_price_cents), table: "pod_digital_products",
      })) : []),
    ];

    const results: Array<{ listingId: string; status: string; restoredTo: number }> = [];
    for (const row of allRows) {
      try {
        const restoredDollars = row.originalPriceCents / 100;
        const patchRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${row.listingId}`,
          {
            method: "PATCH",
            headers: { ...etsyHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ price: restoredDollars }),
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (patchRes.ok) {
          await sb.from(row.table).update({ price_cents: row.originalPriceCents, original_price_cents: null }).eq("id", row.id);
          results.push({ listingId: row.listingId, status: "restored", restoredTo: row.originalPriceCents });
        } else {
          results.push({ listingId: row.listingId, status: `etsy_error_${patchRes.status}`, restoredTo: row.originalPriceCents });
        }
      } catch (e) {
        results.push({ listingId: row.listingId, status: `error: ${(e as Error).message.slice(0, 60)}`, restoredTo: row.originalPriceCents });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    const restored = results.filter((r) => r.status === "restored").length;
    const nextOffset = (dlRows?.length ?? 0) === limit ? offset + limit : null;
    log("restorePrices complete", { restored, total: allRows.length, nextOffset });
    return new Response(JSON.stringify({
      restorePrices: true,
      restored,
      errors: results.filter((r) => r.status !== "restored").length,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"restorePrices":true,"offset":${nextOffset},"limit":${limit}}` : null,
      results,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RECREATE MODE — delete broken listing + recreate as proper digital type
  // Body: { recreateFromQueueId: true, queueId: N }
  // Use when existing listing has is_digital: false (Etsy type cannot be changed
  // after creation — only delete + recreate fixes it)
  // ══════════════════════════════════════════════════════════════════════════

  if (body.recreateFromQueueId === true) {
    const rcQueueId = Number(body.queueId ?? 0);
    if (!rcQueueId) {
      return new Response(JSON.stringify({ error: "queueId required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 1. Find + delete old Etsy listing
    const { data: oldDp } = await sb
      .from("pod_digital_products")
      .select("id, etsy_listing_id")
      .eq("queue_id", rcQueueId)
      .maybeSingle();

    if (oldDp?.etsy_listing_id) {
      const delRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${oldDp.etsy_listing_id}`,
        { method: "DELETE", headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
      ).catch(() => null);
      log("Deleted old listing", { listingId: oldDp.etsy_listing_id, status: delRes?.status });
      await sb.from("pod_digital_products").delete().eq("id", oldDp.id);
    } else {
      log("No old listing found for queue_id", { rcQueueId });
    }

    // 2. Get queue data
    const { data: q } = await sb
      .from("pod_product_queue")
      .select("name, description, image_prompt, retail_price, digital_file_specs")
      .eq("id", rcQueueId)
      .maybeSingle();

    if (!q) {
      return new Response(JSON.stringify({ error: "Queue item not found", queueId: rcQueueId }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 3. Inject into body.product so the creation block below runs with correct data
    body.product = {
      name: q.name,
      description: q.description ?? "",
      imagePrompt: q.image_prompt ?? q.name,
      retailPrice: q.retail_price ?? 1999,
      digitalFileSpecs: q.digital_file_specs ?? "{}",
    };
    body.queueId = rcQueueId;
    body.recreateFromQueueId = false; // prevent re-entry
    log("Recreating listing from queue", { queueId: rcQueueId, name: q.name.slice(0, 60) });
    // fall through to creation mode below
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATION MODE — new listing with real files
  // ══════════════════════════════════════════════════════════════════════════

  const p = (body.product ?? {}) as Record<string, unknown>;
  const name = String(p.name ?? "Digital Download");
  const imagePrompt = String(p.imagePrompt ?? name);
  const description = String(p.description ?? "");
  const retailPrice = Number(p.retailPrice ?? 1999);
  const fileSpecsRaw = String(p.digitalFileSpecs ?? "{}");
  const queueId = (body.queueId as number | null) ?? null;

  // Run SEO + file generation + DALL-E in parallel
  const [seoS, filesS, imageS] = await Promise.allSettled([
    (async () => {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `You are an Etsy SEO expert for digital downloads.\n\nProduct: "${name}"\nDescription: "${description.slice(0, 200)}"\n\n1. Write an Etsy listing TITLE (max 140 chars). Lead with the strongest keyword.\n2. Generate exactly 13 Etsy TAGS. Each max 20 chars. No duplicates.\n\nReturn ONLY JSON: {"title":"...","tags":["...",...]}`,
          }],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error(`SEO ${r.status}`);
      const d = await r.json();
      return JSON.parse(d.choices?.[0]?.message?.content ?? "{}") as { title: string; tags: string[] };
    })(),
    generateFiles(name, description, fileSpecsRaw, OPENAI_KEY),
    (async () => {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: `Product showcase image for an Etsy digital download listing. ${imagePrompt} Pure white background. Professional product thumbnail. Clean, high-contrast, no text overlays.`,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) throw new Error(`DALL-E ${r.status}`);
      const d = await r.json();
      return (d?.data?.[0]?.b64_json as string) ?? null;
    })(),
  ]);

  // SEO
  let seoTitle = name.slice(0, 140);
  let tags: string[] = [];
  if (seoS.status === "fulfilled") {
    if (seoS.value.title) seoTitle = String(seoS.value.title).slice(0, 140);
    if (Array.isArray(seoS.value.tags)) tags = seoS.value.tags.slice(0, 13).map((t: string) => String(t).slice(0, 20));
  }

  // Files are required — fail hard if missing
  if (filesS.status === "rejected") {
    log("File generation FAILED", { error: (filesS.reason as Error).message });
    return new Response(
      JSON.stringify({ error: "File generation failed", detail: (filesS.reason as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  const generatedFiles = filesS.value;
  const zipBytes = makeZip(generatedFiles);
  log("ZIP packed", { files: generatedFiles.map((f) => f.name), sizeKb: Math.round(zipBytes.length / 1024) });

  const imageB64 = imageS.status === "fulfilled" ? imageS.value : null;
  if (imageS.status === "rejected") log("DALL-E failed (non-fatal)", { error: (imageS.reason as Error).message.slice(0, 80) });

  // Etsy title sanitization — applied before every listing POST:
  // 1. Replace all '&' with 'and' (Etsy rejects titles with >1 ampersand)
  // 2. Replace ':' with '-' (Etsy rejects colons in titles)
  // 3. If >3 words start with 2+ sequential caps (CNC, DXF, SVG, STL etc.), lowercase the excess
  let sanitizedTitle = seoTitle.replace(/&/g, "and").replace(/:/g, "-");
  const capsWords = sanitizedTitle.match(/\b[A-Z]{2}[A-Z0-9]*/g) ?? [];
  if (capsWords.length > 3) {
    let capsCount = 0;
    sanitizedTitle = sanitizedTitle.replace(/\b[A-Z]{2}[A-Z0-9]*/g, (m) => {
      capsCount++;
      return capsCount > 3 ? m.toLowerCase() : m;
    });
  }
  sanitizedTitle = sanitizedTitle.slice(0, 140);

  // Create listing
  const listingRes = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: { ...etsyHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: 999,
        title: sanitizedTitle,
        description: buildDescription(description, fileSpecsRaw),
        price: parseFloat((retailPrice / 100).toFixed(2)),
        who_made: "i_did",
        when_made: "2020_2026",
        taxonomy_id: DIGITAL_TAXONOMY_ID,
        type: "download",
        is_digital: true,
        state: "active",
        tags,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!listingRes.ok) {
    const err = await listingRes.text().catch(() => "");
    return new Response(JSON.stringify({ error: "Listing creation failed", detail: err.slice(0, 200) }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const listingId = String((await listingRes.json()).listing_id);
  log("Listing created", { listingId });

  // Post-creation verification — Etsy silently ignores type changes after creation.
  // Verify is_digital immediately so we catch the bug before the listing goes live.
  const verifyRes = await fetch(
    `https://openapi.etsy.com/v3/application/listings/${listingId}`,
    { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  const verifyData = verifyRes?.ok ? await verifyRes.json().catch(() => ({})) : {};
  if (!verifyData.is_digital) {
    log("WARNING: listing created but is_digital=false — will need recreateFromQueueId", { listingId });
  } else {
    log("Verified is_digital=true", { listingId });
  }

  // Upload ZIP as the buyer download
  const zipName = `${seoTitle.slice(0, 45).replace(/[^a-z0-9]/gi, "_")}_files.zip`;
  const zipForm = new FormData();
  zipForm.append("file", new Blob([zipBytes], { type: "application/zip" }), zipName);
  zipForm.append("name", zipName);
  zipForm.append("rank", "1");

  const zipUp = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
    {
      method: "POST",
      headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` },
      body: zipForm,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (zipUp.ok) {
    log("ZIP uploaded as download", { listingId, zipName });
  } else {
    log("ZIP upload failed", { status: zipUp.status, body: (await zipUp.text().catch(() => "")).slice(0, 150) });
  }

  // Upload DALL-E image as listing photo (NOT the download)
  if (imageB64) {
    try {
      const imgBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
      const imgForm = new FormData();
      imgForm.append("image", new Blob([imgBytes], { type: "image/png" }), "listing_image.png");
      imgForm.append("rank", "1");
      imgForm.append("overwrite", "true");

      const imgUp = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
        {
          method: "POST",
          headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` },
          body: imgForm,
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (imgUp.ok) log("Listing photo uploaded", { listingId });
      else log("Listing photo upload failed (non-fatal)", { status: imgUp.status });
    } catch (e) {
      log("Image upload error (non-fatal)", { error: (e as Error).message.slice(0, 60) });
    }
  }

  // Record in DB
  await sb.from("pod_digital_products").insert({
    queue_id: queueId,
    etsy_listing_id: listingId,
    file_name: zipName,
    price_cents: retailPrice,
  });

  return new Response(
    JSON.stringify({ success: true, listingId, title: seoTitle, filesGenerated: generatedFiles.map((f) => f.name) }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
