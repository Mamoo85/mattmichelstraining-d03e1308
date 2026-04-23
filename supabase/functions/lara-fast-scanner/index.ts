// lara-fast-scanner — DISABLED
//
// This function previously probed aca-prod.accela.com/LARA sequentially by
// license ID to detect newly issued licenses. That constitutes unauthorized
// automated access to the Accela portal in violation of their ToS.
//
// The primary LARA data source is the publicly available BPL Excel files at:
//   https://www.michigan.gov/lara/bureau-list/bpl
// Those are downloaded by the Apify actor (main.js excel mode) and are the
// only authorized source until a commercial Accela API agreement is in place.
//
// To re-enable: obtain ACCELA_APP_ID + ACCELA_APP_SECRET from developer.accela.com
// (agency_name "LARA", environment "PROD") and wire up scanAccelaAPI() in
// miosha-license-scraper instead of this file.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ ok: false, disabled: true, reason: "Accela API credentials required — see function comments" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
