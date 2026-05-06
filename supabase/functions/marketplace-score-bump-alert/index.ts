// marketplace-score-bump-alert — every 4h cron
// Finds watched mortgage leads where score jumped +2 since last alert, notifies buyer.
// Only mortgage_radar_leads has score_history — non-mortgage watches are skipped.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to, subject, html }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Only consider mortgage watches — only mortgage_radar_leads has score_history.
  const { data: watches } = await supabase
    .from("marketplace_buyer_watches")
    .select("buyer_email, lead_id, product")
    .eq("product", "mortgage");

  if (!watches?.length) {
    return new Response(JSON.stringify({ ok: true, alerted: 0, reason: "no mortgage watches" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadIds = [...new Set((watches as any[]).map((w) => w.lead_id))];
  const { data: leads } = await supabase
    .from("mortgage_radar_leads")
    .select("id, score, score_history, last_score_alert_at, address, city, zip")
    .in("id", leadIds);

  let alerted = 0;
  for (const lead of (leads || []) as any[]) {
    const history: Array<{ score: number; at: string }> = Array.isArray(lead.score_history)
      ? lead.score_history
      : [];
    if (history.length < 2) continue;
    const prev = history[history.length - 2]?.score ?? 0;
    const cur = lead.score ?? 0;
    if (cur - prev < 2) continue;

    if (
      lead.last_score_alert_at &&
      Date.now() - new Date(lead.last_score_alert_at).getTime() < 24 * 3600 * 1000
    ) {
      continue;
    }

    const buyersForLead = (watches as any[]).filter((w) => w.lead_id === lead.id);
    for (const w of buyersForLead) {
      const html = `
        <h2 style="font-family:system-ui">📈 Score Bump Alert</h2>
        <p>A lead you're watching just jumped from <strong>${prev}</strong> to <strong>${cur}</strong>.</p>
        <p>${lead.address || ""}, ${lead.city || ""} ${lead.zip || ""}</p>
        <p><a href="https://detroitwebagent.com/marketplace?product=${w.product}&lead=${lead.id}" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Lead →</a></p>
      `;
      await sendEmail(w.buyer_email, `📈 Score jumped to ${cur}/10 — lead you're watching`, html);
      alerted++;
    }

    await supabase
      .from("mortgage_radar_leads")
      .update({ last_score_alert_at: new Date().toISOString() })
      .eq("id", lead.id);
  }

  return new Response(JSON.stringify({ ok: true, alerted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
