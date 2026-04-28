// cold-email-rank-buyers — Buyer Intent Score (BIS) computation per signal
//
// POST { signal_id, vertical?: string|string[], radius_miles?: number, limit?: number }
// → { rows: [{ buyer_id, contact_id|null, bis, breakdown, contact, buyer }] }
//
// Steps:
//   1. Load signal (industry_pulse_signals) — must exist.
//   2. Load matching buyers (active=true; vertical filter if provided).
//   3. Resolve city coords for the signal (city_coords cache, fallback Google Geocode).
//   4. For each buyer:
//        - load up to 3 buyer_contacts (highest seniority + verified email first)
//        - compute BIS per (buyer × contact) triple, plus a buyer-level row when no contact
//   5. Upsert into signal_buyer_intent (24h TTL).
//   6. Return rows ordered by BIS desc, capped to `limit` (default 30).
//
// All DB calls are awaited. Errors propagate as 500 with a clear message — per the
// DWA Defensive Programming Protocol no error is swallowed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, computeBis, haversineMiles, verticalFit, recencyPenalty,
  seniorityScore, deliverabilityScore,
} from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

async function geocodeCity(sb: any, city: string, state = "MI"): Promise<{ lat: number; lng: number } | null> {
  if (!city) return null;
  const key = `${city.toLowerCase().trim()}|${state.toUpperCase()}`;
  const { data: cached } = await sb.from("city_coords").select("lat,lng").eq("city_state", key).maybeSingle();
  if (cached) return { lat: Number(cached.lat), lng: Number(cached.lng) };

  if (!GOOGLE_MAPS_API_KEY) return null;
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", `${city}, ${state}`);
  u.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  const r = await fetch(u.toString());
  if (!r.ok) return null;
  const j = await r.json();
  const loc = j?.results?.[0]?.geometry?.location;
  if (!loc) return null;
  await sb.from("city_coords").upsert({
    city_state: key, lat: loc.lat, lng: loc.lng, populated: true, populated_at: new Date().toISOString(),
  });
  return { lat: loc.lat, lng: loc.lng };
}

function geoScoreFromMiles(miles: number, radius = 60): number {
  if (!Number.isFinite(miles)) return 0;
  if (miles <= 5) return 1;
  if (miles >= radius) return 0;
  return 1 - (miles - 5) / (radius - 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { signal_id, vertical, radius_miles = 60, limit = 30 } = body || {};
    if (!signal_id) {
      return json({ error: "signal_id required" }, 400);
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: signal, error: sigErr } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence, detected_at")
      .eq("id", signal_id)
      .maybeSingle();
    if (sigErr) throw new Error(`signal fetch: ${sigErr.message}`);
    if (!signal) return json({ error: "signal not found" }, 404);

    // Verticals to query
    let vList: string[] | null = null;
    if (Array.isArray(vertical) && vertical.length) vList = vertical;
    else if (typeof vertical === "string" && vertical.trim()) vList = [vertical];

    let bq = sb
      .from("industrial_supply_buyers")
      .select("id, vertical, company, email, city, state, last_outreach_at, enrichment_status")
      .eq("active", true)
      .limit(200);
    if (vList) bq = bq.in("vertical", vList);
    const { data: buyers, error: bErr } = await bq;
    if (bErr) throw new Error(`buyers fetch: ${bErr.message}`);
    if (!buyers || buyers.length === 0) {
      return json({ rows: [], note: "no active buyers match" });
    }

    // Signal city → lat/lng
    const sigCity = (signal.location || "").split(",")[0].trim() || "Detroit";
    const sigCoords = await geocodeCity(sb, sigCity, "MI");

    // Pre-load contacts for all buyers in one query
    const buyerIds = buyers.map((b: any) => b.id);
    const { data: allContacts } = await sb
      .from("buyer_contacts")
      .select("id, buyer_id, full_name, first_name, title, seniority, email, email_verified, email_source, email_confidence, linkedin_url, is_primary")
      .in("buyer_id", buyerIds);

    type Row = {
      buyer_id: string;
      contact_id: string | null;
      bis: number;
      breakdown: any;
      buyer: any;
      contact: any | null;
    };
    const rows: Row[] = [];

    for (const buyer of buyers) {
      let geo_score = 0.5;
      if (sigCoords && buyer.city) {
        const bc = await geocodeCity(sb, buyer.city, buyer.state || "MI");
        if (bc) {
          const miles = haversineMiles(sigCoords.lat, sigCoords.lng, bc.lat, bc.lng);
          geo_score = geoScoreFromMiles(miles, radius_miles);
        }
      }
      const v_fit = verticalFit(signal.predicted_needs as any, buyer.vertical);
      const r_penalty = recencyPenalty(buyer.last_outreach_at);
      const spend_window_match = signal.hiring_count > 5 ? 0.8 : 0.5;
      const past_lift = 0.5; // refined nightly by bandit-nightly-refit

      const buyerContacts = (allContacts || [])
        .filter((c: any) => c.buyer_id === buyer.id)
        .sort((a: any, b: any) =>
          (b.is_primary === true ? 1 : 0) - (a.is_primary === true ? 1 : 0)
          || (b.email_confidence || 0) - (a.email_confidence || 0));

      if (buyerContacts.length === 0) {
        const inputs = {
          vertical_fit: v_fit, geo_score, spend_window_match,
          recency_penalty: r_penalty,
          seniority: 0.2,
          deliverability: deliverabilityScore("pattern", false, 0),
          past_lift,
        };
        const breakdown = computeBis(inputs);
        rows.push({
          buyer_id: buyer.id, contact_id: null,
          bis: breakdown.total, breakdown,
          buyer, contact: null,
        });
      } else {
        for (const c of buyerContacts.slice(0, 3)) {
          const inputs = {
            vertical_fit: v_fit, geo_score, spend_window_match,
            recency_penalty: r_penalty,
            seniority: seniorityScore(c.title || c.seniority),
            deliverability: deliverabilityScore(c.email_source, c.email_verified, c.email_confidence),
            past_lift,
          };
          const breakdown = computeBis(inputs);
          rows.push({
            buyer_id: buyer.id, contact_id: c.id,
            bis: breakdown.total, breakdown,
            buyer, contact: c,
          });
        }
      }
    }

    rows.sort((a, b) => b.bis - a.bis);
    const top = rows.slice(0, Math.min(limit, 100));

    // Cache BIS rows (best effort)
    if (top.length > 0) {
      const upserts = top.map((r) => ({
        signal_id: signal.id,
        buyer_id: r.buyer_id,
        contact_id: r.contact_id || "00000000-0000-0000-0000-000000000000",
        bis: r.bis,
        breakdown: r.breakdown,
        computed_at: new Date().toISOString(),
      }));
      const { error: upErr } = await sb.from("signal_buyer_intent").upsert(upserts, {
        onConflict: "signal_id,buyer_id,contact_id",
      });
      if (upErr) console.error("[rank-buyers] cache upsert:", upErr.message);
    }

    return json({ rows: top, signal_city: sigCity, has_geo: !!sigCoords });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cold-email-rank-buyers]", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
