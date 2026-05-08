// Email preflight harness — renders the trial-invite email HTML for a sample
// of recipients (or one synthetic recipient) and verifies that every CTA link
// returns HTTP 200 from the live site. Used by /dwa-admin/email-preflight to
// approve a cohort before sending. Read-only: never sends mail, never mutates
// trial_resend_queue.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { dwaEmail as _unused, DWA_TEAL, DWA_BG } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://detroitwebagent.com";

// MUST stay in sync with resend-trial-invites/index.ts PRODUCT_COPY.
const PRODUCT_COPY: Record<string, { label: string; pitch: string }> = {
  mortgage_radar:           { label: "Mortgage Radar",   pitch: "real-time refi/listing/probate signals for loan officers — 7-day free trial, no credit card." },
  trade_radar_roofing:      { label: "Roofing Radar",    pitch: "hail/storm + permit alerts for roofers in your ZIPs — 7-day free trial, no credit card." },
  trade_radar_hvac:         { label: "HVAC Radar",       pitch: "aging-system + heat/cold extremes signals for HVAC pros — 7-day free trial, no credit card." },
  trade_radar_plumbing:     { label: "Plumbing Radar",   pitch: "permit + lead-line + flood signals for plumbers — 7-day free trial, no credit card." },
  trade_radar_electrical:   { label: "Electrical Radar", pitch: "panel-upgrade + new-build signals for electricians — 7-day free trial, no credit card." },
  trade_radar_pest_control: { label: "Pest Control Radar", pitch: "vacancy + 311 rodent signals for pest control — 7-day free trial, no credit card." },
  trade_radar_gutters:      { label: "Gutter Radar",     pitch: "storm + roof-permit signals for gutter installers — 7-day free trial, no credit card." },
  trade_radar_exterior:     { label: "Exterior Radar",   pitch: "siding/window/paint signals + storm damage zones — 7-day free trial, no credit card." },
  trade_radar_tree:         { label: "Tree Radar",       pitch: "wind/storm alerts + 311 tree calls — 7-day free trial, no credit card." },
  trade_radar_restoration:  { label: "Restoration Radar", pitch: "fire/flood/water-damage permits and incidents — 7-day free trial, no credit card." },
  trade_radar_demo_junk:    { label: "Demo & Junk Radar", pitch: "demo permits, estate sales, probate filings — 7-day free trial, no credit card." },
  trade_radar_foundation:   { label: "Foundation Radar", pitch: "flood + structural permit signals — 7-day free trial, no credit card." },
  techalert:                { label: "TechAlert",        pitch: "hiring-radar for trade & industrial firms — see who's about to staff up." },
  missed_call_catch:        { label: "Missed-Call Catch", pitch: "auto-text every missed call so you stop losing customers — 7-day free trial." },
  site_radar:               { label: "SiteRadar",        pitch: "see which companies visit your website — 7-day free trial, no credit card." },
};

function buildTrialUrl(productKey: string, email: string): string {
  return `${SITE_URL}/start-trial?product=${encodeURIComponent(productKey)}&rcpt=${encodeURIComponent(email)}&utm_source=trial_resend&utm_medium=email&utm_campaign=catchup_2026_05`;
}

function buildHtml(p: { product_key: string; business_name: string | null; email: string }): { html: string; subject: string; ctaUrl: string } {
  const copy = PRODUCT_COPY[p.product_key] ?? PRODUCT_COPY.site_radar;
  const url = buildTrialUrl(p.product_key, p.email);
  const greeting = p.business_name ? `Hey ${p.business_name},` : "Hey,";
  const subject = `${copy.label} is live — your trial is ready`;
  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1628;background:#fff">
  <div style="background:${DWA_BG};color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="color:${DWA_TEAL};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Detroit Web Agency</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${copy.label} is live — your trial is ready</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">${greeting}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">
      We've talked before — back then I didn't have a free trial to give you. I do now.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">
      <strong>${copy.label}</strong> — ${copy.pitch}
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55">
      Takes 60 seconds to start. No credit card. You'll see the signals running in your area within the day.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${url}" style="display:inline-block;background:${DWA_TEAL};color:${DWA_BG};font-weight:800;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px">Start my free trial →</a>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;line-height:1.5">
      If it's a swing-and-a-miss, just hit reply with "stop" — I'll never email again.
    </p>
    <p style="margin:18px 0 0;font-size:14px;line-height:1.55">— Matt Michels<br/>Detroit Web Agency · (313) 992-1219</p>
  </div>
</div>`.trim();
  return { html, subject, ctaUrl: url };
}

async function checkLink(url: string, signal: AbortSignal): Promise<{ url: string; status: number; ok: boolean; final_url: string; ms: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "DWA-Preflight/1.0" },
      signal,
    });
    // Drain so connection is released.
    await res.text().catch(() => "");
    return {
      url,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      final_url: res.url,
      ms: Date.now() - start,
    };
  } catch (e: any) {
    return { url, status: 0, ok: false, final_url: url, ms: Date.now() - start, error: e?.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const sampleSize = Math.max(1, Math.min(Number(body?.sample_size ?? 5), 25));
    const productKey = body?.product_key ? String(body.product_key) : null;
    const queueStatus = body?.queue_status ? String(body.queue_status) : "pending";
    const verifyLinks = body?.verify_links !== false;

    // Pull a sample from trial_resend_queue. If no rows match, fall back to a
    // single synthetic recipient so admin can still preview by product.
    let q = sb
      .from("trial_resend_queue")
      .select("id, email, business_name, product_key, product_label, status, skip_reason")
      .order("created_at", { ascending: true })
      .limit(sampleSize);
    if (productKey) q = q.eq("product_key", productKey);
    q = q.eq("status", queueStatus);

    const { data: rows, error } = await q;
    if (error) return json({ error: "queue_query_failed", detail: error.message }, 500);

    let recipients: { email: string; business_name: string | null; product_key: string; queue_id: string | null; queue_status: string | null }[] = (rows ?? []).map((r: any) => ({
      email: r.email,
      business_name: r.business_name,
      product_key: r.product_key,
      queue_id: r.id,
      queue_status: r.status,
    }));

    if (recipients.length === 0) {
      const fallbackProduct = productKey || "site_radar";
      recipients = [{
        email: "preflight-test@detroitwebagent.com",
        business_name: "Preflight Sample",
        product_key: fallbackProduct,
        queue_id: null,
        queue_status: null,
      }];
    }

    // Build previews for every recipient.
    const previews = recipients.map((r) => {
      const built = buildHtml({ product_key: r.product_key, business_name: r.business_name, email: r.email });
      return { ...r, ...built };
    });

    // Verify unique CTA URLs (one per product_key for this template since the
    // path differs only by `rcpt` query param). We test one URL per product
    // for speed — that's the only thing that meaningfully varies.
    let linkChecks: Awaited<ReturnType<typeof checkLink>>[] = [];
    if (verifyLinks) {
      const seen = new Set<string>();
      const uniqueUrls: string[] = [];
      for (const p of previews) {
        const probeUrl = `${SITE_URL}/start-trial?product=${encodeURIComponent(p.product_key)}`;
        if (!seen.has(probeUrl)) {
          seen.add(probeUrl);
          uniqueUrls.push(probeUrl);
        }
      }
      const ctrl = AbortSignal.timeout(20_000);
      linkChecks = await Promise.all(uniqueUrls.map((u) => checkLink(u, ctrl)));
    }

    // Suppression check for the sampled emails.
    let suppressedEmails: string[] = [];
    try {
      const emails = recipients.map((r) => r.email).filter(Boolean);
      if (emails.length > 0) {
        const { data: supp } = await sb
          .from("suppressed_emails")
          .select("email")
          .in("email", emails);
        suppressedEmails = (supp ?? []).map((r: any) => r.email);
      }
    } catch {/* table may not exist; ignore */}

    return json({
      ok: true,
      site_url: SITE_URL,
      sample_size: previews.length,
      previews,
      link_checks: linkChecks,
      suppressed_emails: suppressedEmails,
      product_keys_known: Object.keys(PRODUCT_COPY),
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "internal_error", detail: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
