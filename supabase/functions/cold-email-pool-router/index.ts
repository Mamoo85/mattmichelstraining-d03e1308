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

const TEMPLATES: Record<string, (b: BuyerRow) => { subject: string; html: string; text: string; key: string }> = {
  staffing_agency: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "staffing_v1",
      subject: `${first} — predictable nurse pipeline for ${b.company_name}?`,
      text: `Hi ${first},\n\nWe surface licensed nurses + allied health pros within 48hrs of their license posting on NURSYS. Most agencies hear about them 2 weeks later from job boards.\n\nWorth a quick look? Reply "yes" and I'll send a 90-second loom.\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We surface licensed nurses + allied health pros within 48hrs of their license posting on NURSYS — most agencies hear about them 2 weeks later from job boards.`, `Want a 90-second loom showing what your ${b.state || "MI"} pipeline would look like?`),
    };
  },
  hospital_hr: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "hospital_hr_v1",
      subject: `${b.company_name} — fill nursing reqs 11 days faster`,
      text: `Hi ${first},\n\nWe alert hospital HR teams the moment a nurse hits their state license registry. Hospitals using us close reqs ~11 days faster than waiting for Indeed/LinkedIn.\n\nQuick 15-min look this week?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We alert hospital HR teams the moment a nurse hits the state license registry — hospitals using us close reqs ~11 days faster than Indeed/LinkedIn alone.`, `Quick 15-min look this week?`),
    };
  },
  trade_contractor: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "trade_v1",
      subject: `${first} — homeowners 30 days from refinancing in ${b.city || "your area"}`,
      text: `Hi ${first},\n\nWe identify homeowners in ${b.city || "your area"} who are 30 days from a refi or new-mortgage closing — high-intent moments where they buy roofing, HVAC, remodels, etc.\n\nWant me to send 5 free sample leads in your zip?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We identify homeowners in ${b.city || "your area"} 30 days from a refi or new-mortgage closing — high-intent moments where they buy roofing, HVAC, remodels.`, `Want 5 free sample leads in your zip?`),
    };
  },
  mortgage_lo: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "mortgage_lo_v1",
      subject: `${first} — pre-FSBO + pre-refi leads in your zip`,
      text: `Hi ${first},\n\nWe surface FSBOs, divorces, and rate-trigger refi candidates 2-4 weeks before they hit Zillow. ~$149/mo flat for your zip.\n\nWant a free 7-day trial?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We surface FSBOs, divorces, and rate-trigger refi candidates 2–4 weeks before they hit Zillow. $149/mo flat for your zip.`, `Free 7-day trial?`),
    };
  },
  property_manager: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "pm_v1",
      subject: `${b.company_name} — never miss a tenant call again`,
      text: `Hi ${first},\n\nWhen your tenants call after-hours, do they leave a voicemail or call your competitor? Our Missed-Call Catch service captures every miss + auto-texts back. $99/mo flat.\n\nWorth a 5-min look?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `When tenants call after-hours, do they leave a voicemail or call your competitor? Our Missed-Call Catch service captures every miss + auto-texts back. $99/mo flat.`, `Worth a 5-min look?`),
    };
  },
  real_estate: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "re_v1",
      subject: `${first} — FSBO + divorce leads in ${b.city || "your area"}`,
      text: `Hi ${first},\n\nWe identify FSBOs, divorce filings, and probate openings in ${b.city || "your area"} 2-3 weeks before they hit MLS. Most agents pay for these from Zillow at $40+/lead — we charge $149/mo flat for your whole zip.\n\nFree 7-day trial?\n\n— Matt\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `We identify FSBOs, divorces, and probate openings in ${b.city || "your area"} 2–3 weeks before they hit MLS. $149/mo flat for your zip.`, `Free 7-day trial?`),
    };
  },
  dental_medical: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "dental_v1",
      subject: `${b.company_name} — recover after-hours patient calls`,
      text: `Hi ${first},\n\nEvery missed call after 5pm is a competitor's new patient. We capture every miss, transcribe the voicemail, and auto-text the patient back within 60 seconds. $99/mo.\n\nWorth a 5-min demo?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `Every missed call after 5pm is a competitor's new patient. We capture every miss, transcribe the voicemail, auto-text the patient back within 60 seconds. $99/mo.`, `Worth a 5-min demo?`),
    };
  },
  auto_repair: (b) => {
    const first = (b.contact_name || "there").split(" ")[0];
    return {
      key: "auto_v1",
      subject: `${b.company_name} — stop losing service calls to voicemail`,
      text: `Hi ${first},\n\nMost shops lose 15-30% of new-customer calls to voicemail when bays are full. We capture, transcribe, and auto-text back within 60s. $99/mo flat.\n\nQuick demo?\n\n— Matt\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`,
      html: poolHtml(`Hi ${first},`, `Most shops lose 15–30% of new-customer calls to voicemail when bays are full. We capture, transcribe, auto-text back within 60s. $99/mo flat.`, `Quick demo?`),
    };
  },
};

function poolHtml(greeting: string, body: string, cta: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#0a1628;max-width:560px">
    <p>${greeting}</p>
    <p>${body}</p>
    <p>${cta}</p>
    <p>— Matt Michels<br>Detroit Web Agency<br>(313) 992-1219<br><a href="https://detroitwebagent.com">detroitwebagent.com</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:11px;color:#6b7280">Reply STOP to opt out. Detroit Web Agency, Grosse Pointe, MI.</p>
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
    const { data: candidates } = await sb
      .from("buyer_pools")
      .select("id,pool,company_name,domain,contact_name,contact_title,contact_email,city,state,quality_score,send_count")
      .eq("pool", t.pool)
      .eq("status", "ready")
      .eq("email_verified", true)
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
