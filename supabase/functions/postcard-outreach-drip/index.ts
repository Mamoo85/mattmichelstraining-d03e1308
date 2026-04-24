// postcard-outreach-drip — D14 retarget postcard via Lob.
// Sends a second 6x4 postcard to postcard_outreach prospects who haven't replied.
// Idempotent: marks d14_sent in drip_campaign_status.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

function retargetCopy(name: string, trade: string, city: string): string {
  const first = (name || "").split(/[\s,]/)[0] || "there";
  return `${first} — sent a postcard 2 weeks back about exclusive ${trade} leads in ${city}. Last call before I give the spot to the next ${trade}. Scan QR or text (313) 992-1219. — Matt, DetroitWebAgent.com`;
}

async function sendLobPostcard(to: any, front: string, back: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!LOB_API_KEY) return { ok: false, err: "LOB_API_KEY missing" };
  try {
    const auth = btoa(`${LOB_API_KEY}:`);
    const r = await fetch("https://api.lob.com/v1/postcards", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        description: "DWA retarget postcard",
        to: JSON.stringify(to),
        from: JSON.stringify({ name: "Matt Michels", address_line1: "PO Box 36174", address_city: "Grosse Pointe", address_state: "MI", address_zip: "48236" }),
        front: `<html><body style="font-family:Arial;padding:30px;text-align:center;background:#0a1628;color:#fff;"><h1 style="font-size:32px;margin:0;">${front}</h1></body></html>`,
        back: `<html><body style="font-family:Arial;padding:20px;font-size:13px;line-height:1.5;">${back}<br><br>QR → DetroitWebAgent.com/contractor-leads</body></html>`,
        size: "4x6",
      }),
    });
    const j = await r.json();
    if (!r.ok) return { ok: false, err: j?.error?.message || `Lob ${r.status}` };
    return { ok: true, id: j.id };
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const cutoffStart = new Date(Date.now() - 15 * 86400000).toISOString();
    const cutoffEnd = new Date(Date.now() - 14 * 86400000).toISOString();

    const { data: rows } = await sb
      .from("outreach_leads" as any)
      .select("id, business_name, city, industry, drip_campaign_status, status")
      .eq("offer_pitched", "postcard_outreach")
      .gte("last_contact_date", cutoffStart)
      .lt("last_contact_date", cutoffEnd)
      .neq("status", "replied_interested")
      .neq("status", "replied_not_interested")
      .limit(25);

    let sent = 0, skipped = 0, failed = 0;
    const samples: any[] = [];

    for (const r of (rows || [])) {
      const drip = r.drip_campaign_status || {};
      if (drip.d14_sent) { skipped++; continue; }
      const addr = drip.channel_target_address;
      if (!addr || !addr.line1) { skipped++; continue; }

      const front = `Last call, ${(r.business_name || "").split(/\s/)[0]}`;
      const back = retargetCopy(r.business_name, r.industry || "contractor", r.city || "your area");

      const lobTo = {
        name: r.business_name,
        address_line1: addr.line1,
        address_city: addr.city || r.city,
        address_state: addr.state || "MI",
        address_zip: addr.zip,
      };

      const result = await sendLobPostcard(lobTo, front, back);
      if (!result.ok) { failed++; continue; }

      await sb.from("outreach_leads" as any).update({
        drip_campaign_status: { ...drip, d14_sent: true, d14_sent_at: new Date().toISOString(), d14_lob_id: result.id },
        last_contact_date: new Date().toISOString(),
      }).eq("id", r.id);

      sent++;
      samples.push({ name: r.business_name, addr: addr.line1, lob_id: result.id });
      await new Promise(rs => setTimeout(rs, 500));
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, failed, samples }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
