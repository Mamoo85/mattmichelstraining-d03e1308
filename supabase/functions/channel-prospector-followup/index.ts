// channel-prospector-followup — daily 10am ET
// Sends D7 and D14 follow-up touches via the same channel as the D0 outreach
// (fax → fax, postcard → postcard, sms → sms). Skips anyone who replied.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const PHAXIO_KEY = Deno.env.get("PHAXIO_API_KEY") || "";
const PHAXIO_SECRET = Deno.env.get("PHAXIO_API_SECRET") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

const DAILY_CAP = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Touch = "d7" | "d14";
type Channel = "fax" | "postcard" | "sms";

function channelFromOffer(offer: string): Channel {
  if (offer === "fax_outreach") return "fax";
  if (offer === "postcard_outreach") return "postcard";
  return "sms";
}

async function aiFollowupCopy(channel: Channel, touch: Touch, name: string, trade: string, city: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return defaultCopy(channel, touch, name, trade, city);
  const dayLabel = touch === "d7" ? "one week ago" : "two weeks ago";
  const prompts: Record<Channel, string> = {
    fax: `Write a short fax follow-up (2 sentences) to ${name}, a ${trade} in ${city}. We reached out ${dayLabel} about exclusive homeowner leads at $399/mo. No contract. End with "Call (313) 992-1219 — Matt, Detroit Web Agency". Casual, direct, not pushy.`,
    postcard: `Write a 1-sentence postcard follow-up to ${name}, a ${trade} in ${city}. We sent a card ${dayLabel} about exclusive ${trade} leads, $399/mo. End with "Matt — DetroitWebAgent.com". Max 30 words.`,
    sms: `Write a follow-up SMS under 120 chars to ${name}, a ${trade} in ${city}. We texted ${dayLabel} about leads. Ask if they're still interested. End "— Matt". No links.`,
  };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 200, messages: [{ role: "user", content: prompts[channel] }] }),
    });
    const j = await r.json();
    return j.content?.[0]?.text?.trim() || defaultCopy(channel, touch, name, trade, city);
  } catch (_) {
    return defaultCopy(channel, touch, name, trade, city);
  }
}

function defaultCopy(channel: Channel, touch: Touch, name: string, trade: string, city: string): string {
  const day = touch === "d7" ? "last week" : "two weeks ago";
  if (channel === "fax") return `FOLLOW-UP MEMO TO: ${name}\n\nReached out ${day} about exclusive ${trade} leads in ${city}, $399/mo flat — wanted to make sure this didn't get lost. Call (313) 992-1219 — Matt, Detroit Web Agency`;
  if (channel === "postcard") return `${name} — following up on our card from ${day}. Exclusive ${trade} leads in ${city}, $399/mo. Matt — DetroitWebAgent.com`;
  return `Hey ${name} — Matt again. Still have exclusive ${trade} leads in ${city} at $399/mo. Interested? — Matt, Detroit Web Agency`;
}

async function sendFax(toFax: string, body: string): Promise<{ ok: boolean; err?: string }> {
  if (!PHAXIO_KEY || !PHAXIO_SECRET) return { ok: false, err: "PHAXIO not configured" };
  try {
    const auth = btoa(`${PHAXIO_KEY}:${PHAXIO_SECRET}`);
    const fd = new FormData();
    fd.append("to", toFax); fd.append("string_data", body); fd.append("string_data_type", "text");
    const r = await fetch("https://api.phaxio.com/v2.1/faxes", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    return r.ok ? { ok: true } : { ok: false, err: await r.text() };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

async function sendPostcard(toAddr: any, text: string): Promise<{ ok: boolean; err?: string }> {
  if (!LOB_API_KEY) return { ok: false, err: "LOB_API_KEY not set" };
  try {
    const auth = btoa(`${LOB_API_KEY}:`);
    const front = `<html><body style="margin:0;padding:40px;font-family:Arial;background:#00d4ff;color:#0a1628;text-align:center;"><h1 style="font-size:42px;margin:0;">Follow-Up</h1></body></html>`;
    const back = `<html><body style="margin:0;padding:40px;font-family:Arial;font-size:15px;line-height:1.6;">${text.replace(/\n/g, "<br>")}</body></html>`;
    const fd = new FormData();
    fd.append("description", "DWA follow-up");
    fd.append("to[name]", toAddr.name); fd.append("to[address_line1]", toAddr.line1);
    fd.append("to[address_city]", toAddr.city); fd.append("to[address_state]", toAddr.state); fd.append("to[address_zip]", toAddr.zip);
    fd.append("from", "adr_3a3deb8f8de87557");
    fd.append("front", front); fd.append("back", back); fd.append("size", "4x6");
    const r = await fetch("https://api.lob.com/v1/postcards", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    return r.ok ? { ok: true } : { ok: false, err: await r.text() };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;
  const now = Date.now();

  try {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("outreach_leads")
      .select("id", { count: "exact", head: true })
      .or(`followup_d7_sent_at.gte.${dayStart.toISOString()},followup_d14_sent_at.gte.${dayStart.toISOString()}`);

    let remaining = DAILY_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "Daily cap reached" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: leads, error } = await sb
      .from("outreach_leads")
      .select("id, business_name, city, industry, phone, offer_pitched, last_contact_date, followup_d7_sent_at, followup_d14_sent_at, drip_campaign_status")
      .not("last_contact_date", "is", null)
      .is("replied_at", null)
      .is("followup_d14_sent_at", null)
      .order("last_contact_date", { ascending: true })
      .limit(remaining);

    if (error) throw error;
    if (!leads?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no leads in follow-up window" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const lead of leads) {
      if (sent >= remaining) break;

      const d0At = new Date(lead.last_contact_date).getTime();
      const daysSince = (now - d0At) / 86400000;

      let touch: Touch | null = null;
      if (daysSince >= 14 && !lead.followup_d14_sent_at) touch = "d14";
      else if (daysSince >= 7 && !lead.followup_d7_sent_at) touch = "d7";

      if (!touch) { skipped++; continue; }

      const channel = channelFromOffer(lead.offer_pitched || "");
      const drip = (lead.drip_campaign_status as any) || {};
      const channelTarget: string = drip.channel_target || "";
      if (!channelTarget) { skipped++; continue; }

      const copy = await aiFollowupCopy(channel, touch, lead.business_name, lead.industry || "contractor", lead.city || "your area");

      let result: { ok: boolean; err?: string };
      if (channel === "fax") {
        result = await sendFax(channelTarget, copy);
      } else if (channel === "postcard") {
        const addr = JSON.parse(channelTarget.includes("{") ? channelTarget : "{}");
        if (!addr.line1) { skipped++; continue; }
        result = await sendPostcard(addr, copy);
      } else {
        result = await sendSMS({ to: channelTarget, body: copy, force: false }).then(
          (r: any) => ({ ok: !!r?.success, err: r?.error || (r?.suppressed ? "TCPA suppressed" : undefined) }),
        );
      }

      if (!result.ok) { failed++; console.error(`[followup] ${lead.business_name} ${touch}: ${result.err}`); continue; }

      const updateField = touch === "d7" ? "followup_d7_sent_at" : "followup_d14_sent_at";
      await sb.from("outreach_leads").update({ [updateField]: new Date().toISOString() }).eq("id", lead.id);
      sent++;
      await new Promise((r) => setTimeout(r, 300));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "channel-prospector-followup",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { sent, skipped, failed, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, failed, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
