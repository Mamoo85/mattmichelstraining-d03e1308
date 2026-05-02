// outreach-email-blast — Drains an active outreach_campaigns row (channel='email')
// up to its daily_send_cap. Skips founders, DNC, do_not_email, suppressed, and
// already-sent (campaign_id+target_id unique). Personalizes via {{first_name}},
// {{business_name}}, {{vertical}}, {{city}}, {{cta_url}}.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";
import { isFounder } from "../_shared/founder-seats.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");

  // Get active email campaigns (filter by id if provided)
  let q = sb.from("outreach_campaigns").select("*").eq("status", "active").eq("channel", "email");
  if (campaignId) q = q.eq("id", campaignId);
  const { data: campaigns, error: cErr } = await q;
  if (cErr) {
    return new Response(JSON.stringify({ error: cErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!campaigns || campaigns.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no_active_email_campaigns" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const c of campaigns) {
    // How many sent today?
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("outreach_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
      .gte("sent_at", since.toISOString());

    const remaining = Math.max(0, (c.daily_send_cap ?? 100) - (sentToday ?? 0));
    if (remaining === 0) {
      results.push({ campaign: c.id, name: c.name, sent_today: sentToday, sent_now: 0, reason: "cap_hit" });
      continue;
    }

    // Find eligible targets: matching vertical+state, has email, not opted out, not founder,
    // not already sent in this campaign.
    const { data: targets, error: tErr } = await sb
      .from("outreach_targets")
      .select("*")
      .in("vertical", c.verticals && c.verticals.length ? c.verticals : ["__none__"])
      .in("state", c.states && c.states.length ? c.states : ["MI"])
      .not("email", "is", null)
      .eq("is_dnc", false)
      .eq("do_not_email", false)
      .eq("is_founder", false)
      .order("last_contacted_at", { ascending: true, nullsFirst: true })
      .limit(remaining * 3); // grab extra to allow filtering of already-sent

    if (tErr) {
      results.push({ campaign: c.id, error: tErr.message });
      continue;
    }
    if (!targets || targets.length === 0) {
      results.push({ campaign: c.id, name: c.name, sent_now: 0, reason: "no_eligible_targets" });
      continue;
    }

    // Filter out already-sent in this campaign
    const ids = targets.map((t) => t.id);
    const { data: existing } = await sb.from("outreach_sends")
      .select("target_id").eq("campaign_id", c.id).in("target_id", ids);
    const sentSet = new Set((existing || []).map((r: any) => r.target_id));
    const eligible = targets.filter((t) => !sentSet.has(t.id) && !isFounder(t.email)).slice(0, remaining);

    let sent = 0, failed = 0;
    for (const t of eligible) {
      const vars: Record<string, string> = {
        first_name: t.owner_first_name || "there",
        last_name: t.owner_last_name || "",
        business_name: t.business_name || "your business",
        vertical: t.vertical || "trade",
        city: t.city || "Michigan",
        state: t.state || "MI",
        cta_url: c.cta_url || "https://detroitwebagent.com",
      };
      const subject = fillTemplate(c.template_subject || `A quick note for ${vars.business_name}`, vars);
      const body = fillTemplate(c.template_body, vars);
      const html = dwaWrap(`<p style="white-space:pre-wrap;line-height:1.6;font-size:15px;">${body}</p>`,
        c.cta_url ? { ctaText: "Start your free 7-day trial →", ctaUrl: c.cta_url } : undefined);

      const res = await dwaEmail({ to: t.email, subject, html });

      const sendRow = {
        campaign_id: c.id,
        target_id: t.id,
        channel: "email",
        provider: "resend",
        recipient_email: t.email,
        status: res.ok ? "sent" : "failed",
        error_message: res.ok ? null : res.error,
        sent_at: res.ok ? new Date().toISOString() : null,
      };
      await sb.from("outreach_sends").insert(sendRow);

      if (res.ok) {
        sent++;
        await sb.from("outreach_targets")
          .update({ last_contacted_at: new Date().toISOString(), contact_count: (t.contact_count ?? 0) + 1 })
          .eq("id", t.id);
      } else {
        failed++;
      }

      // Throttle: 1.5s between sends
      await new Promise((r) => setTimeout(r, 1500));
    }

    await sb.from("outreach_campaigns").update({
      total_sent: (c.total_sent ?? 0) + sent,
      last_run_at: new Date().toISOString(),
    }).eq("id", c.id);

    results.push({ campaign: c.id, name: c.name, eligible: eligible.length, sent, failed });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
