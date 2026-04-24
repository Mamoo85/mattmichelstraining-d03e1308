// marketplace-watch-price-drop — daily 7am ET cron
// Compares current marketplace price to last_price_cents on watch row, emails on drop.
// Works across all products via unified_lead_marketplace_view.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function priceForLead(score: number, ageDays: number): number {
  if (ageDays > 14) return 1500;
  if (ageDays > 7) return 3500;
  if (score >= 8) return 9900;
  if (score >= 6) return 6900;
  return 4900;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: watches } = await supabase
    .from("marketplace_buyer_watches")
    .select("id, buyer_email, lead_id, product, last_price_cents");

  if (!watches?.length) {
    return new Response(JSON.stringify({ ok: true, alerted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadIds = [...new Set((watches as any[]).map((w) => w.lead_id))];
  const { data: leads } = await supabase
    .from("unified_lead_marketplace_view")
    .select("id, score, created_at, city, zip")
    .in("id", leadIds);

  const leadMap = new Map(((leads || []) as any[]).map((l) => [l.id, l]));

  let alerted = 0;
  for (const w of watches as any[]) {
    const lead: any = leadMap.get(w.lead_id);
    if (!lead) continue;
    const ageDays = (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000;
    const currentPrice = priceForLead(lead.score || 0, ageDays);
    const lastPrice = w.last_price_cents ?? currentPrice;

    if (currentPrice < lastPrice) {
      const html = `
        <h2 style="font-family:system-ui">💰 Price Drop Alert</h2>
        <p>A lead you're watching just dropped from <strong>$${(lastPrice / 100).toFixed(0)}</strong> to <strong>$${(currentPrice / 100).toFixed(0)}</strong>.</p>
        <p>${lead.city || ""} ${lead.zip || ""}</p>
        <p><a href="https://detroitwebagent.com/marketplace?product=${w.product}&lead=${lead.id}" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">Grab It →</a></p>
      `;
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: w.buyer_email,
            subject: `💰 Price drop: $${(currentPrice / 100).toFixed(0)}`,
            html,
          }),
        }).catch(() => {});
      }
      alerted++;
    }

    if (currentPrice !== lastPrice) {
      await supabase
        .from("marketplace_buyer_watches")
        .update({ last_price_cents: currentPrice })
        .eq("id", w.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, alerted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
