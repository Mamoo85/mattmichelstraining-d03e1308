/**
 * marketplace-outreach-blast
 * Orchestrates multi-channel outreach: selects prospects, checks cooldowns,
 * delegates to send-fax / send-postcard / cold email, records campaign.
 *
 * POST {
 *   lead_ids: string[],          // mortgage_radar_leads UUIDs (score >= 7 enforced)
 *   prospect_ids?: string[],     // specific prospects; omit = auto-select top 20 by warmth
 *   channel: "email"|"fax"|"postcard",
 *   dry_run?: boolean            // preview without sending
 * }
 * Returns { ok, sent, failed, total_cost_cents, campaign_id, preview? }
 *
 * NOTE: Does NOT touch any scanner tables. Reads mortgage_radar_leads only.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIG_LABELS: Record<string, string> = {
  lis_pendens: "pre-foreclosure filing",
  high_equity_renovation: "high-equity renovation permit",
  new_llc: "new LLC formation",
  foreclosure_notice: "foreclosure notice",
  fsbo: "FSBO listing",
  divorce_filing: "divorce filing",
};

// ─── Cold email builder ────────────────────────────────────────────────────
function buildEmail(prospect: any, lead: any): { subject: string; html: string } {
  const city = lead.city || "Metro Detroit";
  const sigLabel = SIG_LABELS[lead.signal_type] || "mortgage lead signal";
  const firstName = prospect.full_name?.split(" ")[0] || "there";
  const estLoan = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount / 1000)}k`
    : "six figures";
  const commission = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount * 0.01).toLocaleString()}`
    : "~$2,000+";
  const score = lead.score ?? "–";

  const subject = `Exclusive ${city} lead — ${sigLabel} (score ${score}/10)`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px 24px;color:#1a1a2e;font-size:14px;line-height:1.65;}
  a{color:#00d4ff;}
  .cta{display:inline-block;background:#0a1628;color:#00d4ff!important;padding:10px 22px;border-radius:4px;font-weight:bold;text-decoration:none;margin:14px 0;}
  .footer{border-top:1px solid #e5e7eb;margin-top:24px;padding-top:14px;font-size:11px;color:#9ca3af;}
</style></head>
<body>
<p>Hi ${firstName},</p>
<p>I run Detroit Web Agency. We monitor BSEED permits, Wayne County court filings, and public
records across Metro Detroit 24/7 — surfacing high-intent homeowner signals <em>before</em>
they hit the public market.</p>
<p>We just flagged a <strong>${sigLabel}</strong> in <strong>${city}, MI</strong>
(score: ${score}/10, est. loan: ${estLoan}). Only one loan officer gets exclusive access
including full contact info.</p>
<p>That's potentially <strong>${commission}</strong> in your pocket at 1% commission.</p>
<p>If this matches your market, grab it before it posts:</p>
<a class="cta" href="https://detroitwebagent.com/mortgage-radar">Claim This Lead →</a>
<p style="font-size:13px;">Or just reply and I'll send you the details directly.</p>
<p style="margin-top:18px;font-size:13px;">Matt Michels<br/>
Detroit Web Agency<br/>
(313) 992-1219 · <a href="mailto:matt@detroitwebagent.com">matt@detroitwebagent.com</a></p>
<div class="footer">
  Detroit Web Agency · Detroit, MI ·
  <a href="https://detroitwebagent.com/unsubscribe">Unsubscribe</a>
</div>
</body></html>`;

  return { subject, html };
}

async function sendEmail(prospect: any, lead: any): Promise<string | null> {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospect.email || "");
  if (!emailOk || prospect.opt_out_email || !RESEND_API_KEY) return null;
  const { subject, html } = buildEmail(prospect, lead);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [prospect.email],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return res.ok ? (data.id || "sent") : null;
  } catch {
    return null;
  }
}

// ─── Cooldown check (7-day window using lo_outreach_sends) ─────────────────
async function isOnCooldown(sb: any, prospectId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await sb
    .from("lo_outreach_sends")
    .select("id")
    .eq("prospect_id", prospectId)
    .gte("sent_at", cutoff)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// ─── Delegate to channel-specific function ──────────────────────────────────
async function delegateSend(
  channel: "fax" | "postcard",
  prospectId: string,
  leadId: string,
  campaignId: string,
): Promise<{ ok: boolean; cost_cents: number }> {
  const fn = channel === "fax" ? "send-fax" : "send-postcard";
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prospect_id: prospectId, lead_id: leadId, campaign_id: campaignId }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return { ok: Boolean(data?.ok), cost_cents: data?.cost_cents ?? 0 };
  } catch {
    return { ok: false, cost_cents: 0 };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { lead_ids, prospect_ids, channel, dry_run } = body;

    if (!lead_ids?.length) {
      return new Response(JSON.stringify({ ok: false, error: "lead_ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["email", "fax", "postcard"].includes(channel)) {
      return new Response(JSON.stringify({ ok: false, error: "channel must be email, fax, or postcard" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load qualifying leads (score >= 7 gate)
    const { data: leads } = await (sb.from as any)("mortgage_radar_leads")
      .select("*")
      .in("id", lead_ids)
      .gte("score", 7);

    if (!leads?.length) {
      return new Response(JSON.stringify({ ok: false, error: "No leads found with score >= 7" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load prospects
    let pq = (sb.from as any)("marketplace_prospects").select("*").eq("status", "active");
    if (prospect_ids?.length) {
      pq = pq.in("id", prospect_ids);
    } else {
      if (channel === "fax") pq = pq.not("fax_number", "is", null).eq("opt_out_fax", false);
      else if (channel === "postcard") pq = pq.not("mailing_address", "is", null);
      else if (channel === "email") pq = pq.not("email", "is", null).eq("opt_out_email", false);
      pq = pq.order("warmth_score", { ascending: false }).limit(20);
    }
    const { data: prospects } = await pq;

    if (!prospects?.length) {
      return new Response(JSON.stringify({ ok: false, error: `No eligible prospects for channel: ${channel}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const featuredLead = leads[0];

    // Dry-run: preview without sending
    if (dry_run) {
      const { subject, html } = buildEmail(prospects[0], featuredLead);
      return new Response(JSON.stringify({
        ok: true,
        dry_run: true,
        leads_count: leads.length,
        featured_lead: { id: featuredLead.id, signal_type: featuredLead.signal_type, city: featuredLead.city, score: featuredLead.score },
        prospects_eligible: prospects.length,
        channel,
        email_preview: channel === "email" ? { subject, html: html.slice(0, 500) + "…" } : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create campaign record
    const { data: campaign } = await (sb.from as any)("lo_outreach_campaigns").insert({
      channel,
      lead_ids: lead_ids,
      lead_signal_types: [...new Set(leads.map((l: any) => l.signal_type))],
      prospect_count: prospects.length,
      status: "sending",
    }).select("id").single();

    const campaignId: string = campaign?.id;

    let sent = 0;
    let failed = 0;
    let totalCostCents = 0;

    for (const prospect of prospects) {
      // 7-day cooldown check
      if (await isOnCooldown(sb, prospect.id)) { failed++; continue; }

      try {
        let success = false;
        let costCents = 0;

        if (channel === "email") {
          const msgId = await sendEmail(prospect, featuredLead);
          if (msgId) {
            await (sb.from as any)("lo_outreach_sends").insert({
              campaign_id: campaignId,
              prospect_id: prospect.id,
              channel: "email",
              external_id: msgId,
              cost_cents: 0,
            });
            success = true;
          }
        } else {
          const result = await delegateSend(channel as "fax" | "postcard", prospect.id, featuredLead.id, campaignId);
          success = result.ok;
          costCents = result.cost_cents;
        }

        if (success) {
          sent++;
          totalCostCents += costCents;
          // Update prospect last_outreach (fax/postcard do this themselves; email needs it)
          if (channel === "email") {
            await (sb.from as any)("marketplace_prospects").update({
              last_outreach_at: new Date().toISOString(),
              last_outreach_channel: "email",
              updated_at: new Date().toISOString(),
            }).eq("id", prospect.id);
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Finalize campaign
    await (sb.from as any)("lo_outreach_campaigns").update({
      sent_count: sent,
      total_cost_cents: totalCostCents,
      status: "complete",
      completed_at: new Date().toISOString(),
    }).eq("id", campaignId);

    // SMS Matt with summary
    const costDollars = (totalCostCents / 100).toFixed(2);
    await sendSMS(
      ADMIN_PHONE,
      "+13139921219",
      `LO Blast done ✓ ${sent} ${channel}s sent · ${failed} skipped · $${costDollars} cost · Lead: ${featuredLead.signal_type} in ${featuredLead.city || "MI"}`,
      "marketplace-outreach-blast",
    );

    return new Response(
      JSON.stringify({ ok: true, sent, failed, total_cost_cents: totalCostCents, campaign_id: campaignId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
