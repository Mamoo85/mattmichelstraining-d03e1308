// sms-outreach-drip — D3 + D7 follow-up SMS for sms_outreach pitches.
// TCPA-checked via shared sendSMS (which honors sms_opt_outs and quiet hours).
// Idempotent: marks d3_sent / d7_sent flags inside drip_campaign_status.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function d3Body(name: string, trade: string): string {
  const first = (name || "").split(/[\s,]/)[0] || "there";
  return `${first} — Matt at Detroit Web Agency. Followed up on those exclusive ${trade} leads. Still have 2 spots open this week. Reply Y for the 60-sec rundown.`.slice(0, 320);
}

function d7Body(name: string, trade: string): string {
  const first = (name || "").split(/[\s,]/)[0] || "there";
  return `${first} — last note from Matt. The ${trade} lead spot in your area goes to the next yes. Reply Y or LATER and I'll move on. (313) 992-1219.`.slice(0, 320);
}

async function processStage(
  sb: any,
  stage: "d3" | "d7",
  daysAgo: number,
): Promise<{ sent: number; skipped: number; failed: number; samples: any[] }> {
  const cutoffStart = new Date(Date.now() - (daysAgo + 1) * 86400000).toISOString();
  const cutoffEnd = new Date(Date.now() - daysAgo * 86400000).toISOString();

  // Find sms_outreach pitches sent ~daysAgo days ago, no reply, stage not yet sent
  const { data: rows } = await sb
    .from("outreach_leads" as any)
    .select("id, business_name, industry, phone, drip_campaign_status, status")
    .eq("offer_pitched", "sms_outreach")
    .gte("last_contact_date", cutoffStart)
    .lt("last_contact_date", cutoffEnd)
    .neq("status", "replied_interested")
    .neq("status", "replied_not_interested")
    .limit(50);

  let sent = 0, skipped = 0, failed = 0;
  const samples: any[] = [];

  for (const r of (rows || [])) {
    const drip = r.drip_campaign_status || {};
    if (drip[`${stage}_sent`]) { skipped++; continue; }
    if (!r.phone) { skipped++; continue; }

    const body = stage === "d3" ? d3Body(r.business_name, r.industry || "contractor") : d7Body(r.business_name, r.industry || "contractor");
    const result: any = await sendSMS({ to: r.phone, body, force: false }).catch((e: any) => ({ success: false, error: String(e?.message || e) }));

    if (!result?.success) {
      failed++;
      continue;
    }

    await sb.from("outreach_leads" as any).update({
      drip_campaign_status: { ...drip, [`${stage}_sent`]: true, [`${stage}_sent_at`]: new Date().toISOString(), [`${stage}_sid`]: result.sid },
      last_contact_date: new Date().toISOString(),
    }).eq("id", r.id);

    sent++;
    samples.push({ name: r.business_name, phone: r.phone, body: body.slice(0, 80) });
    await new Promise(rs => setTimeout(rs, 400));
  }

  return { sent, skipped, failed, samples };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const d3 = await processStage(sb, "d3", 3);
    const d7 = await processStage(sb, "d7", 7);

    return new Response(JSON.stringify({
      ok: true,
      d3,
      d7,
      total_sent: d3.sent + d7.sent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
