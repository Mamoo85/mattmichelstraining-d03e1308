// outreach-postcard-blast — Drains active outreach_campaigns (channel='postcard') via Lob.
// Requires LOB_API_KEY in Supabase secrets. Sends 6x4 postcard (~$0.85/send).
// Uses simple HTML front+back templates personalized via {{vars}}.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isFounder } from "../_shared/founder-seats.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

// DWA return address — Matt's Grosse Pointe HQ
const FROM_ADDRESS = {
  name: "Matt Michels",
  company: "Detroit Web Agency",
  address_line1: "16860 Kercheval Ave",
  address_city: "Grosse Pointe",
  address_state: "MI",
  address_zip: "48230",
  address_country: "US",
};

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function frontHtml(_vars: Record<string, string>): string {
  return `<html><body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;background:#0a1628;color:#fff;width:6.25in;height:4.25in;">
    <div style="padding:0.6in;text-align:center;">
      <div style="font-size:48pt;font-weight:900;letter-spacing:-2px;color:#00d4ff;line-height:1;">Detroit Web Agency</div>
      <div style="margin-top:0.3in;font-size:18pt;color:#fff;font-weight:600;">Your competitors are stealing your leads.</div>
      <div style="margin-top:0.2in;font-size:13pt;color:#9fb3c8;">Let's fix that this week. →</div>
    </div>
  </body></html>`;
}

function backHtml(body: string, vars: Record<string, string>): string {
  return `<html><body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;background:#fff;color:#111;width:6.25in;height:4.25in;font-size:11pt;line-height:1.45;">
    <div style="padding:0.35in 0.45in;">
      <p style="margin:0 0 8pt 0;">Hi ${vars.first_name || "there"},</p>
      <p style="margin:0 0 8pt 0;white-space:pre-wrap;">${body}</p>
      <p style="margin:10pt 0 0 0;font-weight:600;">Try it free for 7 days — no credit card.</p>
      <p style="margin:4pt 0 0 0;color:#0066aa;">${vars.cta_url || "https://detroitwebagent.com"}</p>
      <p style="margin:14pt 0 0 0;font-size:9pt;color:#666;">Matt Michels · (313) 992-1219 · matt@detroitwebagent.com</p>
    </div>
  </body></html>`;
}

async function sendPostcard(
  to: { name: string; line1: string; city: string; state: string; zip: string },
  front: string,
  back: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!LOB_API_KEY) return { ok: false, error: "lob_not_configured" };
  const auth = "Basic " + btoa(`${LOB_API_KEY}:`);
  const form = new FormData();
  form.append("description", "DWA outreach postcard");
  form.append("to[name]", to.name);
  form.append("to[address_line1]", to.line1);
  form.append("to[address_city]", to.city);
  form.append("to[address_state]", to.state);
  form.append("to[address_zip]", to.zip);
  form.append("to[address_country]", "US");
  form.append("from[name]", FROM_ADDRESS.name);
  form.append("from[company]", FROM_ADDRESS.company);
  form.append("from[address_line1]", FROM_ADDRESS.address_line1);
  form.append("from[address_city]", FROM_ADDRESS.address_city);
  form.append("from[address_state]", FROM_ADDRESS.address_state);
  form.append("from[address_zip]", FROM_ADDRESS.address_zip);
  form.append("from[address_country]", FROM_ADDRESS.address_country);
  form.append("front", front);
  form.append("back", back);
  form.append("size", "6x4");

  const r = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: { Authorization: auth },
    body: form,
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) return { ok: false, error: j?.error?.message || `lob_${r.status}` };
  return { ok: true, id: String(j?.id || "") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!LOB_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "lob_credentials_missing" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");

  let q = sb.from("outreach_campaigns").select("*").eq("status", "active").eq("channel", "postcard");
  if (campaignId) q = q.eq("id", campaignId);
  const { data: campaigns, error: cErr } = await q;
  if (cErr) {
    return new Response(JSON.stringify({ error: cErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!campaigns?.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const c of campaigns) {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await sb.from("outreach_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id).gte("sent_at", since.toISOString());
    const remaining = Math.max(0, (c.daily_send_cap ?? 50) - (sentToday ?? 0));
    if (remaining === 0) { results.push({ campaign: c.id, reason: "cap_hit" }); continue; }

    const { data: targets, error: tErr } = await sb.from("outreach_targets").select("*")
      .in("vertical", c.verticals?.length ? c.verticals : ["__none__"])
      .in("state", c.states?.length ? c.states : ["MI"])
      .not("address_line1", "is", null).not("city", "is", null).not("zip", "is", null)
      .eq("is_dnc", false).eq("do_not_mail", false).eq("is_founder", false)
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(remaining * 3);

    if (tErr) { results.push({ campaign: c.id, error: tErr.message }); continue; }
    if (!targets?.length) { results.push({ campaign: c.id, reason: "no_targets" }); continue; }

    const ids = targets.map((t) => t.id);
    const { data: existing } = await sb.from("outreach_sends")
      .select("target_id").eq("campaign_id", c.id).in("target_id", ids);
    const sentSet = new Set((existing || []).map((r: any) => r.target_id));
    const eligible = targets.filter((t) => !sentSet.has(t.id) && !isFounder(t.email)).slice(0, remaining);

    let sent = 0, failed = 0;
    for (const t of eligible) {
      const vars: Record<string, string> = {
        first_name: t.owner_first_name || "Owner",
        business_name: t.business_name || "your business",
        vertical: t.vertical || "trade",
        city: t.city || "Michigan",
        state: t.state || "MI",
        cta_url: c.cta_url || "https://detroitwebagent.com",
      };
      const body = fillTemplate(c.template_body, vars);
      const front = frontHtml(vars);
      const back = backHtml(body, vars);

      const recipientName = t.owner_first_name && t.owner_last_name
        ? `${t.owner_first_name} ${t.owner_last_name}`
        : t.business_name || "Owner";
      const fullAddress = `${t.address_line1}, ${t.city}, ${t.state} ${t.zip}`;

      const res = await sendPostcard(
        { name: recipientName, line1: t.address_line1, city: t.city, state: t.state, zip: t.zip },
        front,
        back,
      );

      await sb.from("outreach_sends").insert({
        campaign_id: c.id, target_id: t.id, channel: "postcard", provider: "lob",
        recipient_address: fullAddress, status: res.ok ? "sent" : "failed",
        provider_message_id: res.id || null, error_message: res.ok ? null : res.error,
        sent_at: res.ok ? new Date().toISOString() : null, cost_cents: 85,
      });

      if (res.ok) {
        sent++;
        await sb.from("outreach_targets").update({
          last_contacted_at: new Date().toISOString(),
          contact_count: (t.contact_count ?? 0) + 1,
        }).eq("id", t.id);
      } else { failed++; }

      await new Promise((r) => setTimeout(r, 1000));
    }

    await sb.from("outreach_campaigns").update({
      total_sent: (c.total_sent ?? 0) + sent, last_run_at: new Date().toISOString(),
    }).eq("id", c.id);

    results.push({ campaign: c.id, name: c.name, eligible: eligible.length, sent, failed });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
