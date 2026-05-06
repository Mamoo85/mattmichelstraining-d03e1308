// update-tech-location — POST { tech_id, lat, lng }
// Called by the FieldDesk tech app to push GPS position into tech_locations.
// Uses PIN auth (no JWT) — verify_jwt = false in config.toml.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { tech_id, lat, lng } = await req.json();

    if (!tech_id || lat == null || lng == null) {
      return new Response(JSON.stringify({ error: "tech_id, lat, and lng are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error } = await sb
      .from("tech_locations")
      .upsert(
        { tech_id, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: "tech_id" }
      );

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[update-tech-location]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
