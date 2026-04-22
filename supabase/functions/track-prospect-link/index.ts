// Public redirect: /functions/v1/track-prospect-link?token=XYZ
// Logs the click then 302s to /contractor-leads (territory-aware when possible).
// Fail-open: never block the prospect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEST_BASE = "https://detroitwebagent.com/contractor-leads";

// Match the trade slugs accepted by ContractorLeads.tsx + create-contractor-checkout.
const VALID_TRADES = new Set(["electrical", "hvac", "plumbing", "roofing", "boiler", "gutters", "siding"]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  if (!token) {
    const parts = url.pathname.split("/").filter(Boolean);
    token = parts[parts.length - 1] || "";
  }

  let redirectTo = token ? `${DEST_BASE}?ref=${encodeURIComponent(token)}` : DEST_BASE;

  // Resolve trade/city from prospect_nudges so the deep link auto-selects the territory.
  if (token && token !== "track-prospect-link") {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // Fire-and-forget click log
      supabase
        .from("prospect_nudges")
        .update({ clicked_at: new Date().toISOString() })
        .eq("link_token", token)
        .is("clicked_at", null)
        .then(() => {});

      // Lookup trade/city for territory-aware redirect
      const { data: nudge } = await supabase
        .from("prospect_nudges")
        .select("trade, city")
        .eq("link_token", token)
        .maybeSingle();

      if (nudge?.trade && nudge?.city) {
        const tradeSlug = String(nudge.trade).toLowerCase().trim();
        const safeTrade = VALID_TRADES.has(tradeSlug) ? tradeSlug : "";
        const params = new URLSearchParams({ ref: token });
        if (safeTrade) params.set("trade", safeTrade);
        params.set("city", String(nudge.city).trim());
        redirectTo = `${DEST_BASE}?${params.toString()}`;
      }
    } catch (_e) {
      // Fail-open: never break the prospect's journey
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo, "Cache-Control": "no-store" },
  });
});
