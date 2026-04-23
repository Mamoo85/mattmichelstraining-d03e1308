// contractor-checkout-nudge — Hourly cron.
// Finds contractor_clients who submitted the signup form but didn't complete
// Stripe checkout (active=false, phone present, 1–24h old, no nudge sent yet).
// Sends one "I held your territory" SMS with a pre-filled territory link.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const BASE_URL = "https://www.detroitwebagent.com/contractor-leads";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Find inactive contractors who submitted the form between 1-24h ago with a phone
  const { data: candidates, error } = await sb
    .from("contractor_clients")
    .select("id, name, phone, trade, city, email")
    .eq("active", false)
    .not("phone", "is", null)
    .neq("phone", "")
    .gte("created_at", cutoff24h)
    .lte("created_at", cutoff1h);

  if (error) {
    console.error("[contractor-checkout-nudge] query error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!candidates?.length) {
    return new Response(JSON.stringify({ nudged: 0, skipped: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find which ones already received a nudge (check system_comms_log)
  const ids = candidates.map((c: any) => c.id);
  const { data: alreadyNudged } = await sb
    .from("system_comms_log")
    .select("metadata")
    .eq("product", "contractor_checkout_nudge")
    .in("metadata->contractor_id", ids);

  const nudgedContractorIds = new Set(
    (alreadyNudged || []).map((r: any) => r.metadata?.contractor_id).filter(Boolean)
  );

  let nudged = 0;
  let skipped = 0;

  for (const c of candidates as any[]) {
    if (nudgedContractorIds.has(c.id)) { skipped++; continue; }

    const tradeSlug = (c.trade || "").toLowerCase().replace(/\s+/g, "-");
    const citySlug = (c.city || "").trim();
    const firstName = (c.name || "").split(" ")[0] || "there";

    const params = new URLSearchParams({ trade: tradeSlug });
    if (citySlug) params.set("city", citySlug);
    if (c.email) params.set("prefilled_email", c.email);
    const link = `${BASE_URL}?${params.toString()}`;

    const body = `Hey ${firstName} — Matt with Detroit Web Agency. I held your ${c.trade || "contractor"} territory in ${c.city || "your area"} — it's still available. Claim it here: ${link} (reply STOP to opt out)`;

    await sendSMS(c.phone, TWILIO_PHONE, body, "contractor_checkout_nudge");

    // Log to system_comms_log so we don't nudge again
    await sb.from("system_comms_log").insert({
      channel: "sms",
      product: "contractor_checkout_nudge",
      recipient: c.phone,
      message_body: body,
      metadata: { contractor_id: c.id, trade: c.trade, city: c.city },
    });

    nudged++;
  }

  console.log(`[contractor-checkout-nudge] nudged=${nudged} skipped=${skipped}`);
  return new Response(JSON.stringify({ nudged, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
