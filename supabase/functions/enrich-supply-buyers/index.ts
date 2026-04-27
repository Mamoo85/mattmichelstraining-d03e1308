// enrich-supply-buyers
// Idempotent enrichment for industrial_supply_buyers — pulls phone, fax, address
// from Google Places (we already have GOOGLE_MAPS_API_KEY). Best-effort fax scrape
// from website footer via a lightweight regex (no Browserless needed for v1).
//
// POST { buyer_ids?: uuid[], force?: boolean }
//   - If buyer_ids omitted, enriches all rows where enrichment_status='pending'
//   - force=true re-enriches even if status='enriched'
// Returns { processed, enriched, partial, failed }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const MAX_BATCH = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickAddr(components: any[]) {
  const get = (type: string) => components?.find((c) => c.types?.includes(type))?.short_name || "";
  const line1 = `${get("street_number")} ${get("route")}`.trim();
  return {
    line1,
    city: get("locality"),
    state: get("administrative_area_level_1") || "MI",
    zip: get("postal_code"),
  };
}

async function findPlace(query: string): Promise<string | null> {
  const u = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  u.searchParams.set("input", query);
  u.searchParams.set("inputtype", "textquery");
  u.searchParams.set("fields", "place_id");
  u.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  const r = await fetch(u.toString());
  if (!r.ok) return null;
  const j = await r.json();
  return j?.candidates?.[0]?.place_id || null;
}

async function getDetails(placeId: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  u.searchParams.set("place_id", placeId);
  u.searchParams.set("fields", "formatted_phone_number,formatted_address,address_components,website");
  u.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  const r = await fetch(u.toString());
  if (!r.ok) return null;
  const j = await r.json();
  return j?.result || null;
}

const FAX_REGEX = /fax[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/i;

async function scrapeFax(website: string): Promise<string | null> {
  try {
    // Try contact / about page first then root
    const candidates = [website, `${website.replace(/\/$/, "")}/contact`, `${website.replace(/\/$/, "")}/about`];
    for (const url of candidates) {
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA-Enricher/1.0)" },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) continue;
        const html = await r.text();
        const m = html.match(FAX_REGEX);
        if (m) return `+1${m[1]}${m[2]}${m[3]}`;
      } catch { /* try next */ }
    }
  } catch { /* swallow */ }
  return null;
}

function toE164(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { buyer_ids, force } = await req.json().catch(() => ({}));

    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let q = sb.from("industrial_supply_buyers").select("id, company, city, state, enrichment_status").eq("active", true).limit(MAX_BATCH);
    if (Array.isArray(buyer_ids) && buyer_ids.length > 0) {
      q = q.in("id", buyer_ids.slice(0, MAX_BATCH));
    } else if (!force) {
      q = q.eq("enrichment_status", "pending");
    }
    const { data: buyers, error } = await q;
    if (error) throw new Error(`fetch: ${error.message}`);
    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({ processed: 0, enriched: 0, partial: 0, failed: 0, note: "nothing to enrich" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enriched = 0, partial = 0, failed = 0;

    for (const b of buyers) {
      try {
        const query = `${b.company} ${b.city || "Michigan"}`;
        const placeId = await findPlace(query);
        if (!placeId) {
          await sb.from("industrial_supply_buyers").update({ enrichment_status: "not_found", enriched_at: new Date().toISOString() }).eq("id", b.id);
          failed++;
          continue;
        }
        const det = await getDetails(placeId);
        if (!det) { failed++; continue; }

        const phone = toE164(det.formatted_phone_number);
        const addr = pickAddr(det.address_components || []);
        const website = det.website || null;
        const fax = website ? await scrapeFax(website) : null;

        const hasCore = !!phone && !!addr.line1 && !!addr.zip;
        const status = hasCore ? "enriched" : "partial";

        await sb.from("industrial_supply_buyers").update({
          phone,
          fax,
          address: addr.line1 || null,
          city: addr.city || b.city,
          state: addr.state || "MI",
          zip: addr.zip || null,
          website,
          enrichment_status: status,
          enriched_at: new Date().toISOString(),
        }).eq("id", b.id);

        if (status === "enriched") enriched++; else partial++;
      } catch (e) {
        console.error("[enrich]", b.company, e);
        failed++;
      }
      // gentle pacing — Google Places allows 100/sec but we're polite
      await new Promise((r) => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({
      processed: buyers.length, enriched, partial, failed,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[enrich-supply-buyers]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
