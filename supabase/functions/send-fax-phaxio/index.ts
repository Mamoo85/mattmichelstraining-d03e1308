/**
 * send-fax-phaxio — Sends B2B faxes via Phaxio (Sinch Fax API)
 *
 * TCPA SAFETY (CRITICAL):
 *  - Hard caps: MAX_PER_RUN, MAX_PER_MONTH (Matt change here)
 *  - Auto-skip any number in fax_opt_outs
 *  - Auto-inject opt-out footer on every fax
 *  - Refuses to send to prospects flagged verified_public=false
 *  - Logs every send/skip to fax_send_log
 *
 * Trigger: POST { campaign_id, dry_run? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── COST + COMPLIANCE GUARDRAILS (Matt: change here to adjust caps) ─────
const MAX_PER_RUN = 200;
const MAX_PER_MONTH = 1000;
const COST_PER_FAX = 0.07;
const REQUIRE_PUBLIC_VERIFIED = true; // never send to a number not from a public business directory

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PHAXIO_API_KEY = Deno.env.get("PHAXIO_API_KEY") || "";
const PHAXIO_API_SECRET = Deno.env.get("PHAXIO_API_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPT_OUT_FOOTER = `
<hr style="margin-top:24px;border:none;border-top:1px solid #999;"/>
<p style="font-size:9pt;color:#555;margin-top:8px;">
  <strong>To opt out of future faxes</strong> from Detroit Web Agency, call <strong>(313) 992-1219</strong>
  or email <strong>matt@detroitwebagent.com</strong> with the subject "REMOVE FAX". Opt-outs honored within 30 days
  per the Junk Fax Prevention Act of 2005. This fax is sent to a publicly-listed business number.
</p>`;

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DWA Fax Engine <matt@detroitwebagent.com>",
      to: ["matt@detroitwebagent.com"],
      subject,
      html,
    }),
  }).catch(() => {});
}

async function getMonthSentCount(sb: any): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("fax_send_log")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", monthStart.toISOString())
    .eq("status", "sent");
  return count || 0;
}

function normalizeFax(num: string): string {
  const digits = num.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return num;
}

async function sendFaxViaPhaxio(toNumber: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const credentials = btoa(`${PHAXIO_API_KEY}:${PHAXIO_API_SECRET}`);
  const form = new FormData();
  form.append("to", toNumber);
  form.append("string_data", html);
  form.append("string_data_type", "html");
  form.append("header_text", "Detroit Web Agency");

  try {
    const res = await fetch("https://api.phaxio.com/v2.1/faxes", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: String(data?.data?.id || "") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PHAXIO_API_KEY || !PHAXIO_API_SECRET) {
      return new Response(JSON.stringify({ error: "PHAXIO_API_KEY / PHAXIO_API_SECRET not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const campaignId: string | undefined = body.campaign_id;
    const dryRun: boolean = body.dry_run === true;
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: campaign, error: campErr } = await sb
      .from("fax_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull prospects matching segment
    let q = sb.from("fax_prospects").select("*").eq("segment", campaign.target_segment);
    if (REQUIRE_PUBLIC_VERIFIED) q = q.eq("verified_public", true);
    const { data: prospects } = await q;
    const targets = prospects || [];

    // Cost cap: per-run
    if (targets.length > MAX_PER_RUN) {
      const html = `<p>Fax run blocked: <strong>${targets.length}</strong> prospects exceeds MAX_PER_RUN cap of ${MAX_PER_RUN}.</p>
        <p>Campaign: ${campaign.name}</p>
        <p>To allow, raise MAX_PER_RUN in <code>send-fax-phaxio/index.ts</code> or split the campaign.</p>`;
      await notifyMatt("⚠️ Fax run blocked — exceeds per-run cap", html);
      return new Response(JSON.stringify({
        error: "exceeds_per_run_cap", attempted: targets.length, cap: MAX_PER_RUN,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cost cap: per-month
    const monthSent = await getMonthSentCount(sb);
    if (monthSent + targets.length > MAX_PER_MONTH) {
      const html = `<p>Fax run blocked: <strong>${monthSent}</strong> already sent this month + <strong>${targets.length}</strong> in this run would exceed MAX_PER_MONTH cap of ${MAX_PER_MONTH}.</p>
        <p>Campaign: ${campaign.name}</p>`;
      await notifyMatt("⚠️ Fax run blocked — exceeds monthly cap", html);
      return new Response(JSON.stringify({
        error: "exceeds_monthly_cap", month_sent: monthSent, attempted: targets.length, cap: MAX_PER_MONTH,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true, would_send: targets.length, est_cost: +(targets.length * COST_PER_FAX).toFixed(2),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute sends
    let sent = 0, skipped = 0, failed = 0;
    const html_body = (campaign.message_html || "") + OPT_OUT_FOOTER;

    for (const p of targets) {
      const faxNum = normalizeFax(p.fax_number);

      // Check opt-out registry
      const { data: optOut } = await sb
        .from("fax_opt_outs").select("id").eq("fax_number", faxNum).maybeSingle();
      if (optOut) {
        skipped++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, status: "skipped_opt_out", cost: 0,
        });
        continue;
      }

      const result = await sendFaxViaPhaxio(faxNum, html_body);
      if (result.ok) {
        sent++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, phaxio_id: result.id, status: "sent", cost: COST_PER_FAX,
        });
      } else {
        failed++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, status: "failed", error_message: result.error, cost: 0,
        });
      }
      await new Promise(r => setTimeout(r, 250)); // rate limit
    }

    const totalCost = +(sent * COST_PER_FAX).toFixed(2);
    await sb.from("fax_campaigns").update({
      status: "sent", sent_at: new Date().toISOString(),
      total_sent: sent, total_cost: totalCost,
    }).eq("id", campaignId);

    await notifyMatt(
      `📠 Fax campaign sent: ${campaign.name}`,
      `<p><strong>${sent}</strong> sent · <strong>${skipped}</strong> opt-out · <strong>${failed}</strong> failed · cost <strong>$${totalCost}</strong></p>`,
    );

    return new Response(JSON.stringify({ ok: true, sent, skipped, failed, cost: totalCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-fax-phaxio]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
