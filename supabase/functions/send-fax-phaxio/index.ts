/**
 * send-fax-phaxio — Sends B2B faxes via Phaxio (Sinch Fax API)
 *
 * HONESTY UPDATE 2026-04-20 — mirrors send-postcards:
 *  - dry_run mode (Diagnose) → returns prospect counts + Phaxio API health, no sends
 *  - prospect_ids[] filter (Resend Failed) → only sends to specified prospects
 *  - Logs EVERY attempt to fax_send_log (sent / failed / skipped_opt_out)
 *  - Marks campaign 'sent' only if sentCount > 0; 'failed' otherwise w/ last_error
 *  - Auto-injects multi-offer footer (4 products, 1 QR-style URL to fax landing page)
 *  - Honors fax_opt_outs registry on every send
 *
 * Trigger: POST { campaign_id, dry_run?, prospect_ids? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_PER_RUN = 200;
const MAX_PER_MONTH = 1000;
const COST_PER_FAX = 0.07;
const REQUIRE_PUBLIC_VERIFIED = true;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PHAXIO_API_KEY = Deno.env.get("PHAXIO_API_KEY") || "";
const PHAXIO_API_SECRET = Deno.env.get("PHAXIO_API_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const LANDING_BASE = "https://detroitwebagent.com/fax";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Multi-offer footer (4 products, single landing URL) ────────────────
function buildFooter(audience: string, campaignId: string): string {
  const utm = `?audience=${encodeURIComponent(audience || "general")}&utm_campaign=${campaignId}&src=fax`;
  const url = `${LANDING_BASE}${utm}`;
  return `
<hr style="margin-top:24px;border:none;border-top:2px solid #00d4ff;"/>
<table style="width:100%;margin-top:14px;font-family:Arial,sans-serif;">
  <tr>
    <td style="vertical-align:top;width:62%;padding-right:10px;">
      <p style="font-size:11pt;color:#0a1628;margin:0 0 6px 0;font-weight:bold;">
        Plus 3 more free tools — visit:
      </p>
      <p style="font-size:13pt;color:#00658a;margin:0 0 8px 0;font-weight:bold;letter-spacing:0.5px;">
        ${url}
      </p>
      <table style="font-size:10pt;color:#0a1628;line-height:1.6;">
        <tr><td style="padding-right:8px;">🔧</td><td><strong>FieldDesk</strong> — dispatch board for service techs</td></tr>
        <tr><td style="padding-right:8px;">📞</td><td><strong>Missed Call Catch</strong> — auto-text back missed calls</td></tr>
        <tr><td style="padding-right:8px;">📡</td><td><strong>SiteRadar</strong> — see who visited your website</td></tr>
      </table>
    </td>
    <td style="vertical-align:top;width:38%;border-left:1px solid #ccc;padding-left:12px;">
      <p style="font-size:9pt;color:#555;margin:0;line-height:1.4;">
        <strong>To opt out</strong> of future faxes from Detroit Web Agency, call
        <strong>(313) 992-1219</strong> or email
        <strong>matt@detroitwebagent.com</strong> with subject "REMOVE FAX".
        Opt-outs honored within 30 days per the Junk Fax Prevention Act of 2005.
        Sent to a publicly-listed business number.
      </p>
    </td>
  </tr>
</table>`;
}

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DWA Fax Engine <matt@detroitwebagent.com>",
      to: [ADMIN_EMAIL], subject, html,
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
  const digits = (num || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return num;
}

async function checkPhaxioHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!PHAXIO_API_KEY || !PHAXIO_API_SECRET) {
    return { ok: false, error: "PHAXIO_API_KEY / PHAXIO_API_SECRET not configured" };
  }
  const credentials = btoa(`${PHAXIO_API_KEY}:${PHAXIO_API_SECRET}`);
  try {
    const res = await fetch("https://api.phaxio.com/v2.1/account/status", {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const campaignId: string | undefined = body.campaign_id;
    const dryRun: boolean = body.dry_run === true;
    const prospectIds: string[] | undefined = Array.isArray(body.prospect_ids) ? body.prospect_ids : undefined;

    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: campaign, error: campErr } = await sb
      .from("fax_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audience = campaign.audience_type || campaign.target_segment || "general";

    // Pull prospects matching segment
    let q = sb.from("fax_prospects").select("*").eq("segment", campaign.target_segment);
    if (REQUIRE_PUBLIC_VERIFIED) q = q.eq("verified_public", true);
    if (prospectIds && prospectIds.length) q = q.in("id", prospectIds);
    const { data: prospects } = await q;
    const allTargets = prospects || [];

    // For non-resend runs: filter out anyone already sent
    const targets = prospectIds && prospectIds.length
      ? allTargets
      : allTargets.filter((p: any) => !p.fax_sent_at);
    const alreadySent = allTargets.length - targets.length;

    // ── DIAGNOSE / DRY RUN ───────────────────────────────────────────────
    if (dryRun) {
      const [phaxioHealth, monthSent] = await Promise.all([
        checkPhaxioHealth(),
        getMonthSentCount(sb),
      ]);
      const noFax = allTargets.filter((p: any) => !p.fax_number).length;
      return new Response(JSON.stringify({
        campaign_segment: campaign.target_segment,
        audience_type: audience,
        prospects_in_segment: allTargets.length,
        ready_to_send: targets.length,
        already_sent: alreadySent,
        no_fax_number: noFax,
        phaxio_api_ok: phaxioHealth.ok,
        phaxio_error: phaxioHealth.error || null,
        month_sent_so_far: monthSent,
        month_remaining: Math.max(0, MAX_PER_MONTH - monthSent),
        per_run_cap: MAX_PER_RUN,
        estimated_cost_if_sent: +(targets.length * COST_PER_FAX).toFixed(2),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!PHAXIO_API_KEY || !PHAXIO_API_SECRET) {
      return new Response(JSON.stringify({ error: "PHAXIO_API_KEY / PHAXIO_API_SECRET not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cost cap: per-run
    if (targets.length > MAX_PER_RUN) {
      const html = `<p>Fax run blocked: <strong>${targets.length}</strong> prospects exceeds MAX_PER_RUN cap of ${MAX_PER_RUN}.</p>
        <p>Campaign: ${campaign.name}</p>`;
      await notifyMatt("⚠️ Fax run blocked — exceeds per-run cap", html);
      await sb.from("fax_campaigns").update({ last_error: `exceeds per-run cap (${targets.length} > ${MAX_PER_RUN})` }).eq("id", campaignId);
      return new Response(JSON.stringify({
        success: false, error: "exceeds_per_run_cap", attempted: targets.length, cap: MAX_PER_RUN,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cost cap: per-month
    const monthSent = await getMonthSentCount(sb);
    if (monthSent + targets.length > MAX_PER_MONTH) {
      const html = `<p>Fax run blocked: <strong>${monthSent}</strong> already sent this month + <strong>${targets.length}</strong> in this run would exceed MAX_PER_MONTH cap of ${MAX_PER_MONTH}.</p>`;
      await notifyMatt("⚠️ Fax run blocked — exceeds monthly cap", html);
      await sb.from("fax_campaigns").update({ last_error: `exceeds monthly cap` }).eq("id", campaignId);
      return new Response(JSON.stringify({
        success: false, error: "exceeds_monthly_cap", month_sent: monthSent, attempted: targets.length, cap: MAX_PER_MONTH,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute sends
    let sent = 0, skipped = 0, failed = 0;
    let lastError: string | null = null;
    const html_body = (campaign.message_html || "") + buildFooter(audience, campaignId);

    for (const p of targets) {
      const faxNum = normalizeFax(p.fax_number);
      if (!faxNum || faxNum.length < 10) {
        failed++;
        lastError = `invalid fax number: ${p.fax_number}`;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: p.fax_number || "",
          business_name: p.business_name, audience_type: audience,
          status: "failed", error_message: lastError, cost: 0,
        });
        continue;
      }

      // Check opt-out registry
      const { data: optOut } = await sb
        .from("fax_opt_outs").select("id").eq("fax_number", faxNum).maybeSingle();
      if (optOut) {
        skipped++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, audience_type: audience,
          status: "skipped_opt_out", cost: 0,
        });
        continue;
      }

      const result = await sendFaxViaPhaxio(faxNum, html_body);
      if (result.ok) {
        sent++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, audience_type: audience,
          phaxio_id: result.id, status: "sent", cost: COST_PER_FAX,
        });
        await sb.from("fax_prospects").update({
          fax_sent_at: new Date().toISOString(),
          fax_send_id: result.id || null,
        }).eq("id", p.id);
      } else {
        failed++;
        lastError = result.error || "unknown phaxio error";
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, audience_type: audience,
          status: "failed", error_message: lastError, cost: 0,
        });
      }
      await new Promise(r => setTimeout(r, 250)); // rate limit
    }

    const totalCost = +(sent * COST_PER_FAX).toFixed(2);

    // Honest status update
    const isResend = !!(prospectIds && prospectIds.length);
    if (!isResend) {
      await sb.from("fax_campaigns").update({
        status: sent > 0 ? "sent" : "failed",
        sent_at: sent > 0 ? new Date().toISOString() : null,
        total_sent: sent,
        total_cost: totalCost,
        last_error: sent === 0 ? (lastError || "all sends failed") : null,
      }).eq("id", campaignId);
    } else {
      // Resend: increment counts
      await sb.from("fax_campaigns").update({
        total_sent: (campaign.total_sent || 0) + sent,
        total_cost: +((campaign.total_cost || 0) + totalCost).toFixed(2),
        last_error: failed > 0 ? lastError : null,
      }).eq("id", campaignId);
    }

    await notifyMatt(
      `📠 Fax campaign ${isResend ? "resend" : "sent"}: ${campaign.name}`,
      `<p><strong>${sent}</strong> sent · <strong>${skipped}</strong> opt-out · <strong>${failed}</strong> failed · cost <strong>$${totalCost}</strong></p>
       ${lastError ? `<p style="color:#a00;">Last error: ${lastError}</p>` : ""}`,
    );

    return new Response(JSON.stringify({
      success: sent > 0, sent, skipped, failed, cost: totalCost, last_error: lastError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[send-fax-phaxio]", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
