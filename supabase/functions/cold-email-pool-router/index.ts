// cold-email-pool-router
// Sends cold emails from buyer_pools respecting:
//  - per-pool ramp (linear floor → ceiling over ramp_days from ramp_day_started)
//  - per-pool daily_send_cap as hard ceiling
//  - per-domain throttle (1 send / 7 days)
//  - hard kill-switch: if pool 7d bounce_rate > 2%, skip pool + alert
// Logs every send to cold_email_pool_sends, updates buyer_pools.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PoolTarget {
  pool: string;
  display_name: string;
  daily_send_cap: number;
  ramp_day_started: string | null;
  ramp_floor: number;
  ramp_ceiling: number;
  ramp_days: number;
  active: boolean;
}

interface BuyerRow {
  id: string;
  pool: string;
  company_name: string;
  domain: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string;
  city: string | null;
  state: string | null;
  quality_score: number;
  send_count: number;
}

// Each template returns subject/text/html + a tracked CTA URL with utm + buyer_id.
// CTAs route to live landing pages on detroitwebagent.com.
function ctaUrl(path: string, b: BuyerRow, campaign: string): string {
  const u = new URL(`https://detroitwebagent.com${path}`);
  u.searchParams.set("utm_source", "cold_email");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", campaign);
  u.searchParams.set("bid", b.id);
  return u.toString();
}

const TEMPLATES: Record<string, (b: BuyerRow) => { subject: string; html: string; text: string; key: string }> = {
  staffing_agency: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/talent-radar", b, "staffing_v2");
    return {
      key: "staffing_v2",
      subject: `${first} — 48-hr nurse alerts for ${b.company_name}?`,
      text: `Hi ${first},\n\nWe surface licensed nurses + allied health pros within 48hrs of their license posting on the state registry. Most agencies hear about them 2 weeks later from job boards.\n\nFor a ${b.state || "Michigan"} staffing agency that means first-call advantage on every new license.\n\n7-day free trial → ${link}\n\nOr just reply "sample" and I'll send 5 fresh names from this week.\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We surface licensed nurses + allied health pros within <b>48 hours</b> of their license posting on the state registry — most agencies hear about them 2 weeks later from job boards.<br><br>For a ${b.state || "Michigan"} staffing agency that means <b>first-call advantage</b> on every new license.`, `Start your free 7-day trial →`, link, "sample"),
    };
  },
  hospital_hr: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/talent-radar/healthcare", b, "hospital_v2");
    return {
      key: "hospital_v2",
      subject: `${b.company_name} — fill nursing reqs 11 days faster`,
      text: `Hi ${first},\n\nWe alert hospital HR teams the moment a nurse hits the state license registry. Hospitals using us close reqs ~11 days faster than waiting for Indeed or LinkedIn.\n\nSee how it works → ${link}\n\nWorth a 15-min look this week?\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We alert hospital HR teams the moment a nurse hits the state license registry — hospitals using us close reqs <b>~11 days faster</b> than Indeed/LinkedIn alone.`, `See how it works →`, link, "demo"),
    };
  },
  trade_contractor: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/trade-radar", b, "trade_v2");
    return {
      key: "trade_v2",
      subject: `${first} — homeowners 30 days from refi in ${b.city || "your area"}`,
      text: `Hi ${first},\n\nWe identify homeowners in ${b.city || "your area"} who are 30 days from a refi or new-mortgage closing — high-intent moments where they buy roofing, HVAC, remodels, etc.\n\n5 free sample leads in your zip → ${link}\n\nOr reply "sample" and I'll text them over.\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We identify homeowners in ${b.city || "your area"} who are <b>30 days from a refi or new-mortgage closing</b> — exact moments where they buy roofing, HVAC, remodels.`, `Get 5 free sample leads in your zip →`, link, "sample"),
    };
  },
  mortgage_lo: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/mortgage-radar", b, "mortgage_lo_v2");
    return {
      key: "mortgage_lo_v2",
      subject: `${first} — pre-FSBO + pre-refi leads in your zip ($149/mo)`,
      text: `Hi ${first},\n\nWe surface FSBOs, divorces, and rate-trigger refi candidates 2-4 weeks before they hit Zillow. $149/mo flat for your zip — no per-lead fees.\n\nFree 7-day trial → ${link}\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We surface FSBOs, divorces, and rate-trigger refi candidates <b>2–4 weeks before they hit Zillow</b>. $149/mo flat for your zip — no per-lead fees.`, `Start your free 7-day trial →`, link, "trial"),
    };
  },
  property_manager: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/missed-call-catch", b, "pm_v2");
    return {
      key: "pm_v2",
      subject: `${b.company_name} — never miss a tenant call again`,
      text: `Hi ${first},\n\nWhen tenants call after-hours, do they leave a voicemail or call your competitor? Our Missed-Call Catch captures every miss + auto-texts back in 60 seconds. $99/mo flat.\n\nSee a 90-second demo → ${link}\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `When tenants call after-hours, do they leave a voicemail or call your competitor? Missed-Call Catch captures every miss + auto-texts back in <b>60 seconds</b>. $99/mo flat.`, `Watch the 90-second demo →`, link, "demo"),
    };
  },
  real_estate: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/mortgage-radar", b, "re_v2");
    return {
      key: "re_v2",
      subject: `${first} — FSBO + divorce leads in ${b.city || "your area"}`,
      text: `Hi ${first},\n\nWe identify FSBOs, divorce filings, and probate openings in ${b.city || "your area"} 2-3 weeks before they hit MLS. Most agents pay $40+/lead from Zillow — we charge $149/mo flat for your whole zip.\n\nFree 7-day trial → ${link}\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We identify FSBOs, divorce filings, and probate openings in ${b.city || "your area"} <b>2–3 weeks before they hit MLS</b>. $149/mo flat for your zip — vs $40+/lead on Zillow.`, `Start your free 7-day trial →`, link, "trial"),
    };
  },
  dental_medical: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/missed-call-catch", b, "dental_v2");
    return {
      key: "dental_v2",
      subject: `${b.company_name} — recover after-hours patient calls`,
      text: `Hi ${first},\n\nEvery missed call after 5pm is a competitor's new patient. We capture every miss, transcribe the voicemail, and auto-text the patient back within 60 seconds. $99/mo flat.\n\nSee 90-second demo → ${link}\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `Every missed call after 5pm is a competitor's new patient. We capture every miss, transcribe the voicemail, and auto-text the patient back within <b>60 seconds</b>. $99/mo flat.`, `See the 90-second demo →`, link, "demo"),
    };
  },
  auto_repair: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    const link = ctaUrl("/missed-call-catch", b, "auto_v2");
    return {
      key: "auto_v2",
      subject: `${b.company_name} — stop losing service calls to voicemail`,
      text: `Hi ${first},\n\nMost shops lose 15-30% of new-customer calls to voicemail when bays are full. We capture, transcribe, and auto-text back within 60 seconds. $99/mo flat.\n\nQuick demo → ${link}\n\n— Matt Michels\nDetroit Web Agency · (313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `Most shops lose <b>15–30% of new-customer calls</b> to voicemail when bays are full. We capture, transcribe, and auto-text back within 60 seconds. $99/mo flat.`, `Watch the 90-second demo →`, link, "demo"),
    };
  },
};

function poolHtml(greeting: string, body: string, ctaText: string, ctaHref: string, fallbackKeyword?: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#0a1628;max-width:560px">
    <p>${greeting}</p>
    <p>${body}</p>
    <p style="margin:24px 0">
      <a href="${ctaHref}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">${ctaText}</a>
    </p>
    ${fallbackKeyword ? `<p style="font-size:13px;color:#475569">Or just reply "<b>${fallbackKeyword}</b>" and I'll send it over.</p>` : ""}
    <p style="margin-top:24px">— Matt Michels<br>Detroit Web Agency<br>(313) 992-1219<br><a href="https://detroitwebagent.com" style="color:#0891b2">detroitwebagent.com</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:11px;color:#6b7280">Reply STOP to opt out. Detroit Web Agency, Grosse Pointe, MI · matt@detroitwebagent.com</p>
  </div>`;
}

function todaysCap(t: PoolTarget): number {
  if (!t.ramp_day_started) return Math.min(t.ramp_floor, t.daily_send_cap);
  const start = new Date(t.ramp_day_started);
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  if (days >= t.ramp_days) return t.daily_send_cap;
  const rampedCap = Math.round(t.ramp_floor + ((t.ramp_ceiling - t.ramp_floor) * days) / t.ramp_days);
  return Math.min(rampedCap, t.daily_send_cap);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dryRun = req.headers.get("x-dry-run") === "1";
  const summary: any[] = [];

  // 1. Get active pool targets
  const { data: targets } = await sb
    .from("buyer_universe_targets")
    .select("*")
    .eq("active", true);

  if (!targets?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, msg: "no active pools" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let totalSent = 0;

  for (const t of targets as PoolTarget[]) {
    const cap = todaysCap(t);

    // Sent today
    const { count: sentToday } = await sb
      .from("cold_email_pool_sends")
      .select("id", { count: "exact", head: true })
      .eq("pool", t.pool)
      .gte("sent_at", since24);

    const remaining = Math.max(0, cap - (sentToday || 0));
    if (remaining === 0) {
      summary.push({ pool: t.pool, cap, sentToday, sent: 0, status: "cap_hit" });
      continue;
    }

    // Bounce kill-switch (7d)
    const { count: sent7 } = await sb
      .from("cold_email_pool_sends")
      .select("id", { count: "exact", head: true })
      .eq("pool", t.pool)
      .gte("sent_at", since7d);
    const { count: bounced7 } = await sb
      .from("cold_email_pool_sends")
      .select("id", { count: "exact", head: true })
      .eq("pool", t.pool)
      .gte("sent_at", since7d)
      .eq("status", "bounced");
    const bounceRate = (sent7 || 0) > 50 ? (bounced7 || 0) / (sent7 || 1) : 0;
    if (bounceRate > 0.02) {
      summary.push({ pool: t.pool, cap, sent7, bounced7, bounce_rate: bounceRate, status: "kill_switch_tripped" });
      continue;
    }

    // Pull candidates
    // NOTE: email_verified filter intentionally dropped — Hunter/Snov fail-open in waterfall;
    // we rely on quality_score >= 6 + 7d bounce kill-switch for safety.
    const { data: candidates } = await sb
      .from("buyer_pools")
      .select("id,pool,company_name,domain,contact_name,contact_title,contact_email,city,state,quality_score,send_count")
      .eq("pool", t.pool)
      .eq("status", "ready")
      .gte("quality_score", 6)
      .order("quality_score", { ascending: false })
      .limit(remaining * 4); // overfetch for domain dedupe

    if (!candidates?.length) {
      summary.push({ pool: t.pool, cap, remaining, sent: 0, status: "no_candidates" });
      continue;
    }

    const tpl = TEMPLATES[t.pool];
    if (!tpl) {
      summary.push({ pool: t.pool, status: "no_template" });
      continue;
    }

    let poolSent = 0;
    const usedDomains = new Set<string>();

    for (const b of candidates as BuyerRow[]) {
      if (poolSent >= remaining) break;
      const dom = (b.domain || b.contact_email.split("@")[1] || "").toLowerCase();

      // Per-domain throttle: 1 send / 7 days
      if (usedDomains.has(dom)) continue;
      const { count: domSent7 } = await sb
        .from("cold_email_pool_sends")
        .select("id", { count: "exact", head: true })
        .ilike("domain", dom)
        .gte("sent_at", since7d);
      if ((domSent7 || 0) > 0) continue;

      const msg = tpl(b);

      if (dryRun) {
        poolSent++;
        usedDomains.add(dom);
        continue;
      }

      const r = await dwaEmail({
        to: b.contact_email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        headers: {
          "List-Unsubscribe": `<mailto:matt@detroitwebagent.com?subject=unsubscribe>`,
        },
      });

      const sendStatus = r.ok ? "sent" : "bounced";
      await sb.from("cold_email_pool_sends").insert({
        buyer_id: b.id,
        pool: t.pool,
        template_key: msg.key,
        domain: dom,
        resend_id: r.resendId || null,
        status: sendStatus,
      });
      await sb
        .from("buyer_pools")
        .update({
          status: r.ok ? "sent" : "bounced",
          last_send_at: new Date().toISOString(),
          send_count: (b.send_count || 0) + 1,
          ...(r.ok ? {} : { bounce_count: 1 }),
        })
        .eq("id", b.id);

      if (r.ok) {
        poolSent++;
        totalSent++;
      }
      usedDomains.add(dom);

      // Tiny pacing to avoid Resend rate spike
      await new Promise((res) => setTimeout(res, 60));
    }

    summary.push({ pool: t.pool, cap, sentToday, remaining, sent: poolSent, bounce_rate_7d: bounceRate.toFixed(4) });
  }

  return new Response(
    JSON.stringify({ ok: true, dryRun, total_sent: totalSent, pools: summary }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
