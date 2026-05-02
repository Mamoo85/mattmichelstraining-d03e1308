// outreach-fax-blast — Drains active outreach_campaigns (channel='fax') via Sinch Fax API.
// Requires SINCH_KEY_ID + SINCH_KEY_SECRET + SINCH_PROJECT_ID in Supabase secrets.
// Sends an HTML page rendered to fax by Sinch. Cost ~$0.07/page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFounder } from "../_shared/founder-seats.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SINCH_KEY_ID = Deno.env.get("SINCH_KEY_ID") || "";
const SINCH_KEY_SECRET = Deno.env.get("SINCH_KEY_SECRET") || "";
const SINCH_PROJECT_ID = Deno.env.get("SINCH_PROJECT_ID") || "";
const SINCH_FROM = Deno.env.get("SINCH_FAX_FROM") || ""; // optional caller-id fax number

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

async function sendFax(faxNumber: string, htmlContent: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!SINCH_KEY_ID || !SINCH_KEY_SECRET || !SINCH_PROJECT_ID) return { ok: false, error: "sinch_not_configured" };
  const auth = "Basic " + btoa(`${SINCH_KEY_ID}:${SINCH_KEY_SECRET}`);
  // Sinch Fax API v3: POST https://fax.api.sinch.com/v3/projects/{projectId}/faxes
  // contentUrl OR fileContent (base64). We use base64 HTML wrapped as a fax file.
  const body: Record<string, unknown> = {
    to: [faxNumber],
    fileContent: btoa(unescape(encodeURIComponent(htmlContent))),
    fileContentType: "text/html",
  };
  if (SINCH_FROM) body.from = SINCH_FROM;
  const r = await fetch(`https://fax.api.sinch.com/v3/projects/${SINCH_PROJECT_ID}/faxes`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) return { ok: false, error: j?.message || j?.error?.message || `sinch_${r.status}` };
  return { ok: true, id: String(j?.id || j?.faxId || "") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!PHAXIO_KEY || !PHAXIO_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "phaxio_credentials_missing", note: "Set PHAXIO_API_KEY and PHAXIO_API_SECRET in Supabase secrets to enable fax outreach." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");

  let q = sb.from("outreach_campaigns").select("*").eq("status", "active").eq("channel", "fax");
  if (campaignId) q = q.eq("id", campaignId);
  const { data: campaigns } = await q;
  if (!campaigns?.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const c of campaigns) {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await sb.from("outreach_sends")
      .select("id", { count: "exact", head: true }).eq("campaign_id", c.id).gte("sent_at", since.toISOString());
    const remaining = Math.max(0, (c.daily_send_cap ?? 50) - (sentToday ?? 0));
    if (remaining === 0) { results.push({ campaign: c.id, reason: "cap_hit" }); continue; }

    const { data: targets } = await sb.from("outreach_targets").select("*")
      .in("vertical", c.verticals?.length ? c.verticals : ["__none__"])
      .in("state", c.states?.length ? c.states : ["MI"])
      .not("fax", "is", null).eq("is_dnc", false).eq("do_not_fax", false).eq("is_founder", false)
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(remaining * 3);

    if (!targets?.length) { results.push({ campaign: c.id, reason: "no_targets" }); continue; }
    const ids = targets.map((t) => t.id);
    const { data: existing } = await sb.from("outreach_sends").select("target_id").eq("campaign_id", c.id).in("target_id", ids);
    const sentSet = new Set((existing || []).map((r: any) => r.target_id));
    const eligible = targets.filter((t) => !sentSet.has(t.id) && !isFounder(t.email)).slice(0, remaining);

    let sent = 0, failed = 0;
    for (const t of eligible) {
      const vars: Record<string, string> = {
        first_name: t.owner_first_name || "Owner",
        business_name: t.business_name || "your business",
        vertical: t.vertical || "trade",
        city: t.city || "Michigan",
        cta_url: c.cta_url || "https://detroitwebagent.com",
      };
      const body = fillTemplate(c.template_body, vars);
      const html = `<html><body style="font-family:Helvetica,sans-serif;font-size:14px;padding:40px;line-height:1.5;">
        <p>${body.replace(/\n/g, "<br/>")}</p>
        <p style="margin-top:30px;">— Matt Michels, Detroit Web Agency · (313) 992-1219 · detroitwebagent.com</p>
      </body></html>`;
      const res = await sendFax(t.fax!, html);
      await sb.from("outreach_sends").insert({
        campaign_id: c.id, target_id: t.id, channel: "fax", provider: "phaxio",
        recipient_fax: t.fax, status: res.ok ? "sent" : "failed",
        provider_message_id: res.id || null, error_message: res.ok ? null : res.error,
        sent_at: res.ok ? new Date().toISOString() : null, cost_cents: 7,
      });
      if (res.ok) {
        sent++;
        await sb.from("outreach_targets").update({ last_contacted_at: new Date().toISOString(), contact_count: (t.contact_count ?? 0) + 1 }).eq("id", t.id);
      } else { failed++; }
      await new Promise((r) => setTimeout(r, 2000));
    }

    await sb.from("outreach_campaigns").update({ total_sent: (c.total_sent ?? 0) + sent, last_run_at: new Date().toISOString() }).eq("id", c.id);
    results.push({ campaign: c.id, eligible: eligible.length, sent, failed });
  }

  return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
