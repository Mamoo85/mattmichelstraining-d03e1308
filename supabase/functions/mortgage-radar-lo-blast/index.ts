// mortgage-radar-lo-blast — Cold-email Michigan loan officers pitching Mortgage Radar.
// Drains marketplace_prospects rows (populated by find-lo-prospects + enrich-lo-prospect),
// sends a personalized teaser email with a 7-day trial CTA.
//
// Daily cap: 100 (deliverability-safe; H.R. 2808 trigger-lead pain is the hook).
// Compliance: respects outreach-blocklist + marketing-kill-switch + email_send_log dedup.

import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail, listUnsubHeaders } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_CAP = parseInt(Deno.env.get("LO_BLAST_CAP") || "100", 10);
const SITE = "https://detroitwebagent.com";

function firstName(full: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] || "there";
}

function buildEmailHtml(p: {
  fullName: string | null;
  company: string | null;
  city: string | null;
}): string {
  const fn = firstName(p.fullName);
  const co = p.company ? ` at ${p.company}` : "";
  const where = p.city || "Michigan";

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:600px;">
<p>Hey ${fn},</p>

<p>Quick one — since H.R. 2808 killed credit-bureau trigger leads in March, most MI loan officers I've talked to${co} are flying blind on intent signals.</p>

<p>I built <b>Mortgage Radar</b> to fill that gap with public-record buying signals (no credit bureau data — fully FCRA/TCPA clean):</p>

<ul style="padding-left:18px;margin:14px 0;">
  <li>FSBO listings hitting Zillow + EstateSales.net daily</li>
  <li>Probate filings + court records (homeowners about to sell)</li>
  <li>Permit + parcel-sale signals across Wayne / Oakland / Macomb (and statewide on request)</li>
  <li>Each lead scored 1–10 with a Street View + suggested opener</li>
</ul>

<p>$149/mo, ZIP-locked (one LO per territory), 7-day free trial, cancel anytime.</p>

<p>Want a free week to see the leads coming through ${where}?</p>

<p>— Matt Michels<br/>
Detroit Web Agency<br/>
(313) 992-1219</p>

<p style="margin-top:18px;"><a href="${SITE}/start-trial?product=mortgage_radar&utm_source=lo_cold&utm_medium=email" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:700;padding:11px 22px;border-radius:6px;text-decoration:none;">Start your free 7-day trial →</a></p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Marketing kill-switch
  try {
    const ks = await isMarketingBlocked(sb);
    if (ks.blocked) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "marketing_kill_switch", detail: ks.reason }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (_) { /* fail open */ }

  // Pull eligible LO prospects: has email, never contacted via this template
  const { data: prospects, error } = await sb
    .from("marketplace_prospects")
    .select("id, full_name, company, city, state, email, nmls_id")
    .not("email", "is", null)
    .order("enriched_at", { ascending: false, nullsFirst: false })
    .limit(DAILY_CAP * 3);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get already-contacted emails (this template) so we don't double-send
  const emails = (prospects || []).map((p) => p.email).filter(Boolean) as string[];
  const { data: alreadySent } = await sb
    .from("email_send_log")
    .select("recipient_email")
    .eq("template_name", "mortgage_radar_lo_blast")
    .in("recipient_email", emails);
  const sentSet = new Set((alreadySent || []).map((r) => r.recipient_email));

  let sent = 0, failed = 0, blocked = 0, skipped = 0, dupe = 0;

  for (const p of (prospects || [])) {
    if (sent >= DAILY_CAP) break;
    if (!p.email || !p.email.includes("@")) { skipped++; continue; }
    if (sentSet.has(p.email)) { dupe++; continue; }

    // Blocklist check
    try {
      const block = await isBlocked(sb, { email: p.email, business_name: p.company || undefined });
      if (block.blocked) { blocked++; continue; }
    } catch (_) { /* fail open */ }

    const subject = `${firstName(p.full_name)} — clean replacement for trigger leads in ${p.city || "MI"}?`;
    const html = buildEmailHtml({ fullName: p.full_name, company: p.company, city: p.city });

    const r = await dwaColdEmail({
      to: p.email,
      subject,
      bodyHtml: html,
      product: "Mortgage Radar",
      ctaUrl: `${SITE}/start-trial?product=mortgage_radar&utm_source=lo_cold&utm_medium=email`,
      templateName: "mortgage_radar_lo_blast",
      plainMode: true,
    }, sb);

    if (r.ok) {
      sent++;
      sentSet.add(p.email); // dedupe within this run too
    } else {
      failed++;
      console.warn("[mortgage-radar-lo-blast]", p.email, r.error);
    }

    // Pace ~1 email per 2s
    await new Promise((res) => setTimeout(res, 2000));
  }

  return new Response(
    JSON.stringify({ ok: true, sent, failed, blocked, skipped, dupe, eligible_pool: prospects?.length || 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
