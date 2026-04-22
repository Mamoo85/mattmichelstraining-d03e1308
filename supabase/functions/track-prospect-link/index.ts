// Public redirect: /functions/v1/track-prospect-link?token=XYZ
// Logs the click then 302s to /contractor-leads (territory-aware when possible).
// Honors expires_at (24h) and consumed_at (one-time) flags.
// Fail-open for unknown tokens: never block the prospect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEST_BASE = "https://detroitwebagent.com/contractor-leads";

const VALID_TRADES = new Set(["electrical", "hvac", "plumbing", "roofing", "boiler", "gutters", "siding"]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  if (!token) {
    const parts = url.pathname.split("/").filter(Boolean);
    token = parts[parts.length - 1] || "";
  }

  let redirectTo = token ? `${DEST_BASE}?ref=${encodeURIComponent(token)}` : DEST_BASE;

  if (token && token !== "track-prospect-link") {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // Lookup nudge — need expiry/consumption + trade/city
      const { data: nudge } = await supabase
        .from("prospect_nudges")
        .select("trade, city, expires_at, consumed_at")
        .eq("link_token", token)
        .maybeSingle();

      // Expiry / consumption check
      if (nudge) {
        const now = Date.now();
        const expired =
          (nudge.expires_at && new Date(nudge.expires_at as string).getTime() < now) ||
          !!nudge.consumed_at;
        if (expired) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${DEST_BASE}?expired=1`, "Cache-Control": "no-store" },
          });
        }
      }

      // Fire-and-forget click log + one-time consumption mark
      const updates: Record<string, string> = { clicked_at: new Date().toISOString() };
      if (nudge?.expires_at) {
        // Only mark consumed when this is a one-time / expiring link
        updates.consumed_at = new Date().toISOString();
      }
      supabase
        .from("prospect_nudges")
        .update(updates)
        .eq("link_token", token)
        .then(() => {});

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
