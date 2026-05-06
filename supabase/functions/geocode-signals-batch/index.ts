/**
 * geocode-signals-batch
 *
 * Nightly cron: takes signals with NULL lat/lng and a non-null `location`,
 * geocodes via Mapbox Geocoding API (cheap: $0.50/1000), writes lat/lng back.
 *
 * Falls back gracefully:
 *   - If MAPBOX_TOKEN missing → uses a free, rate-limited Nominatim fallback
 *     (1 req/sec) so the system never fully stalls.
 *   - Hard cap: 500 signals per run to keep edge function under 25s.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN") || "";

const BATCH_LIMIT = 500;
const NOMINATIM_DELAY_MS = 1100; // be nice to OSM

async function geocodeMapbox(loc: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loc)}.json?country=us&limit=1&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j?.features?.[0];
  if (!f?.center || !Array.isArray(f.center)) return null;
  return { lng: f.center[0], lat: f.center[1] };
}

async function geocodeNominatim(loc: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(loc)}`;
  const r = await fetch(url, { headers: { "User-Agent": "DemandRadar/1.0 (matt@detroitwebagent.com)" } });
  if (!r.ok) return null;
  const arr = await r.json();
  const f = arr?.[0];
  if (!f) return null;
  return { lat: parseFloat(f.lat), lng: parseFloat(f.lon) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const useMapbox = MAPBOX_TOKEN.length > 0;

  try {
    const { data: pending, error } = await supabase
      .from("industry_pulse_signals")
      .select("id, location")
      .is("lat", null)
      .not("location", "is", null)
      .order("detected_at", { ascending: false })
      .limit(BATCH_LIMIT);

    if (error) throw new Error(`load pending: ${error.message}`);
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, ms: Date.now() - startedAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let geocoded = 0;
    let failed = 0;
    const cache = new Map<string, { lat: number; lng: number } | null>();
    const now = new Date().toISOString();

    for (const row of pending) {
      const loc = (row.location || "").trim();
      if (!loc) continue;

      let coords = cache.get(loc);
      if (coords === undefined) {
        try {
          coords = useMapbox ? await geocodeMapbox(loc) : await geocodeNominatim(loc);
          cache.set(loc, coords);
        } catch (e) {
          console.error(`geocode err for "${loc}":`, e);
          coords = null;
          cache.set(loc, null);
        }
        if (!useMapbox) await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS));
      }

      if (coords) {
        const { error: uErr } = await supabase
          .from("industry_pulse_signals")
          .update({ lat: coords.lat, lng: coords.lng, geocoded_at: now })
          .eq("id", row.id);
        if (uErr) {
          failed++;
        } else {
          geocoded++;
        }
      } else {
        // Mark as attempted (set geocoded_at without lat/lng to skip next run)
        await supabase
          .from("industry_pulse_signals")
          .update({ geocoded_at: now })
          .eq("id", row.id);
        failed++;
      }

      // Time guard — Edge functions cap at ~25s wall
      if (Date.now() - startedAt > 22000) {
        console.log("time guard hit, stopping early");
        break;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        provider: useMapbox ? "mapbox" : "nominatim",
        candidates: pending.length,
        geocoded,
        failed,
        ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("geocode-signals-batch failed:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
