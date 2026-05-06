/**
 * send-fax-phaxio — Sends B2B faxes via Sinch Fax API v3
 *
 * HONESTY UPDATE 2026-04-20 — mirrors send-postcards:
 *  - dry_run mode (Diagnose) → returns prospect counts + Sinch API health, no sends
 *  - prospect_ids[] filter (Resend Failed) → only sends to specified prospects
 *  - Logs EVERY attempt to fax_send_log (sent / failed / skipped_opt_out)
 *  - Marks campaign 'sent' only if sentCount > 0; 'failed' otherwise w/ last_error
 *  - Auto-injects multi-offer footer (4 products, 1 QR-style URL to fax landing page)
 *  - Honors fax_opt_outs registry on every send
 *
 * Trigger: POST { campaign_id, dry_run?, prospect_ids? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_PER_RUN = 200;
const MAX_PER_MONTH = 1000;
const COST_PER_FAX = 0.07;
const REQUIRE_PUBLIC_VERIFIED = true;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SINCH_PROJECT_ID = Deno.env.get("SINCH_PROJECT_ID") || "";
const SINCH_KEY_ID     = Deno.env.get("SINCH_KEY_ID") || "";
const SINCH_KEY_SECRET = Deno.env.get("SINCH_KEY_SECRET") || "";
const FAX_FROM         = Deno.env.get("SINCH_FAX_FROM") || "";
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

async function checkSinchHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!SINCH_PROJECT_ID || !SINCH_KEY_ID || !SINCH_KEY_SECRET) {
    return { ok: false, error: "SINCH_PROJECT_ID / SINCH_KEY_ID / SINCH_KEY_SECRET not configured" };
  }
  try {
    const auth = btoa(`${SINCH_KEY_ID}:${SINCH_KEY_SECRET}`);
    const res = await fetch(
      `https://fax.api.sinch.com/v3/projects/${SINCH_PROJECT_ID}/faxes?page_size=1`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10_000) },
    );
    // 200 (list) or 404 (no faxes yet) both mean the API is reachable and credentials work
    if (res.status === 200 || res.status === 404) return { ok: true };
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 160)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendFaxViaSinch(
  sb: any,
  toNumber: string,
  html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!SINCH_PROJECT_ID || !SINCH_KEY_ID || !SINCH_KEY_SECRET) {
    return { ok: false, error: "Sinch creds not configured" };
  }
  // Upload HTML to Supabase Storage so Sinch can fetch it via contentUrl
  const storageKey = `fax-temp/sinch-${Date.now()}-${Math.random().toString(36).slice(2)}.html`;
  const { error: uploadErr } = await sb.storage
    .from("lead-dossier-pdfs")
    .upload(storageKey, new TextEncoder().encode(html), { contentType: "text/html", upsert: true });
  if (uploadErr) return { ok: false, error: `Storage upload failed: ${uploadErr.message}` };

  const { data: urlData } = sb.storage.from("lead-dossier-pdfs").getPublicUrl(storageKey);
  const contentUrl = urlData?.publicUrl;
  if (!contentUrl) return { ok: false, error: "Failed to get public URL for fax content" };

  try {
    const auth = btoa(`${SINCH_KEY_ID}:${SINCH_KEY_SECRET}`);
    const fd = new FormData();
    fd.append("to", toNumber);
    if (FAX_FROM) fd.append("from", FAX_FROM);
    fd.append("contentUrl", contentUrl);
    const res = await fetch(
      `https://fax.api.sinch.com/v3/projects/${SINCH_PROJECT_ID}/faxes`,
      { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd, signal: AbortSignal.timeout(30_000) },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Sinch ${res.status}: ${JSON.stringify(data)}` };
    return { ok: true, id: String(data?.id || data?.faxId || "") };
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

    // Resolve prospect_ids: explicit body param > campaign.prospect_ids (Outreach Command Center)
    const campaignProspectIds: string[] = Array.isArray((campaign as any).prospect_ids) ? (campaign as any).prospect_ids : [];
    const effectiveIds: string[] = (prospectIds && prospectIds.length) ? prospectIds : campaignProspectIds;
    const usePool = effectiveIds.length > 0;

    let prospects: any[] = [];
    const resolutionTrace: string[] = [];
    const mapPool = (p: any) => ({
      id: p.id,
      business_name: p.business_name,
      fax_number: p.fax_number,
      segment: p.audience_type,
      fax_sent_at: p.status === "sent_fax" ? (p.last_sent_at || null) : null,
      _source: "prospect_pool",
    });

    if (usePool) {
      // Primary: prospect_pool by ID. Skip segment filter when explicit IDs supplied.
      const { data: poolData } = await sb
        .from("prospect_pool")
        .select("id, business_name, fax_number, audience_type, status, last_sent_at")
        .in("id", effectiveIds);
      prospects = (poolData || []).map(mapPool);
      resolutionTrace.push(`prospect_pool:${prospects.length}/${effectiveIds.length}`);

      // Fallback A: any unresolved IDs → try fax_prospects by ID
      if (prospects.length < effectiveIds.length) {
        const found = new Set(prospects.map((p) => p.id));
        const missing = effectiveIds.filter((id) => !found.has(id));
        const { data: faxData } = await sb.from("fax_prospects").select("*").in("id", missing);
        const more = (faxData || []).map((p: any) => ({ ...p, _source: "fax_prospects" }));
        prospects.push(...more);
        resolutionTrace.push(`fax_prospects_by_id:${more.length}/${missing.length}`);
      }
    } else {
      // Legacy path: fax_prospects table filtered by segment
      let q = sb.from("fax_prospects").select("*").eq("segment", campaign.target_segment);
      if (REQUIRE_PUBLIC_VERIFIED) q = q.eq("verified_public", true);
      const { data } = await q;
      prospects = (data || []).map((p: any) => ({ ...p, _source: "fax_prospects" }));
      resolutionTrace.push(`segment(${campaign.target_segment}):${prospects.length}`);

      // Fallback B: 0 from segment but campaign has prospect_ids → try fax_prospects by ID
      if (prospects.length === 0 && campaignProspectIds.length > 0) {
        const { data: byId } = await sb.from("fax_prospects").select("*").in("id", campaignProspectIds);
        prospects = (byId || []).map((p: any) => ({ ...p, _source: "fax_prospects" }));
        resolutionTrace.push(`fallback_fax_prospects_by_id:${prospects.length}/${campaignProspectIds.length}`);

        // Fallback C: still 0 → prospect_pool by ID
        if (prospects.length === 0) {
          const { data: pool } = await sb
            .from("prospect_pool")
            .select("id, business_name, fax_number, audience_type, status, last_sent_at")
            .in("id", campaignProspectIds);
          prospects = (pool || []).map(mapPool);
          resolutionTrace.push(`fallback_prospect_pool_by_id:${prospects.length}/${campaignProspectIds.length}`);
        }
      }
    }
    const allTargets = prospects;
    console.log(`[send-fax-phaxio] campaign=${campaignId} resolution: ${resolutionTrace.join(" | ")}`);

    // For explicit-IDs runs (resend or Command Center): trust the selected list.
    // For legacy segment scans: skip anyone already faxed.
    const targets = (prospectIds && prospectIds.length) || usePool
      ? allTargets
      : allTargets.filter((p: any) => !p.fax_sent_at);
    const alreadySent = allTargets.length - targets.length;

    // ── DIAGNOSE / DRY RUN ───────────────────────────────────────────────
    if (dryRun) {
      const [sinchHealth, monthSent] = await Promise.all([
        checkSinchHealth(),
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
        sinch_api_ok: sinchHealth.ok,
        sinch_error: sinchHealth.error || null,
        month_sent_so_far: monthSent,
        month_remaining: Math.max(0, MAX_PER_MONTH - monthSent),
        per_run_cap: MAX_PER_RUN,
        estimated_cost_if_sent: +(targets.length * COST_PER_FAX).toFixed(2),
        resolution_trace: resolutionTrace,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PRE-FLIGHT: invalid targets gate ─────────────────────────────────
    if (allTargets.length === 0) {
      const errMsg = `0 targets resolved (${resolutionTrace.join(" | ")})`;
      await sb.from("fax_campaigns").update({
        status: "invalid_targets",
        last_error: errMsg,
      }).eq("id", campaignId);
      await notifyMatt(
        `⚠️ Fax campaign blocked — invalid targets: ${campaign.name}`,
        `<p>Campaign <strong>${campaign.name}</strong> resolved 0 prospects.</p>
         <p>Trace: <code>${resolutionTrace.join(" | ")}</code></p>
         <p>Likely cause: prospect_ids reference rows that no longer exist in either prospect_pool or fax_prospects, or segment label doesn't match any rows.</p>`,
      );
      return new Response(JSON.stringify({
        success: false, error: "invalid_targets", resolution_trace: resolutionTrace,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!SINCH_PROJECT_ID || !SINCH_KEY_ID || !SINCH_KEY_SECRET) {
      return new Response(JSON.stringify({ error: "SINCH_PROJECT_ID / SINCH_KEY_ID / SINCH_KEY_SECRET not configured" }), {
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

      const result = await sendFaxViaSinch(sb, faxNum, html_body);
      if (result.ok) {
        sent++;
        await sb.from("fax_send_log").insert({
          prospect_id: p.id, campaign_id: campaignId, fax_number: faxNum,
          business_name: p.business_name, audience_type: audience,
          sinch_id: result.id, status: "sent", cost: COST_PER_FAX,
        });
        if (p._source === "prospect_pool") {
          await sb.from("prospect_pool").update({
            status: "sent_fax",
            last_sent_at: new Date().toISOString(),
            send_count: ((p as any).send_count || 0) + 1,
          }).eq("id", p.id);
        } else {
          await sb.from("fax_prospects").update({
            fax_sent_at: new Date().toISOString(),
            fax_send_id: result.id || null,
          }).eq("id", p.id);
        }
      } else {
        failed++;
        lastError = result.error || "unknown sinch error";
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
    // Treat body-supplied prospect_ids as a resend (incremental). Campaign-level
    // prospect_ids from Outreach Command Center are the campaign's first run.
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
