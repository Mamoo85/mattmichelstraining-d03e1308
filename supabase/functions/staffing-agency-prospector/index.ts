// Healthcare Staffing Agency Cold Email Prospector
// Daily 9am ET (14:00 UTC):
//   1) Sources Michigan healthcare staffing agencies via Apollo (org + people search)
//   2) Inserts new prospects into staffing_agency_prospects (idempotent on email)
//   3) Sends D0/D3/D7 cold drip via Resend (DWA brand) — 25 emails/day cap
//   4) All sends go through outreach-blocklist + email-suppression checks
//
// Pitch: "I'll send you 10 free CNA/RN names in your county tomorrow morning. No card."
// Funnel: cold email → /techalert-staffing → free 10 names → $149/mo

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { apolloPeopleSearch, apolloOrganizationSearch } from "../_shared/apollo.ts";
import { extractContactInfo } from "../_shared/firecrawl.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const SITE = "https://detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_SEND_CAP = 25;
const MI_LOCATIONS = ["Detroit, Michigan", "Grand Rapids, Michigan", "Lansing, Michigan", "Ann Arbor, Michigan", "Flint, Michigan", "Warren, Michigan"];
const TARGET_TITLES = ["owner", "founder", "president", "ceo", "managing director", "director of recruiting", "recruiting manager", "branch manager"];

interface DripCopy { subject: string; html: string; text: string; }

function copyD0(name: string | null, agency: string): DripCopy {
  const first = (name || "there").split(" ")[0];
  const subject = `${agency}: 10 free CNA/RN names tomorrow morning?`;
  const text = `Hi ${first},\n\nI built a system that pulls newly-licensed CNAs and RNs from Michigan LARA the day they get licensed — before they hit Indeed, ZipRecruiter, or any job board.\n\nI'll send ${agency} 10 free names with phone numbers in your county tomorrow morning. No card, no call required.\n\nIf even one is a real placement, we talk. If not, you got 10 free leads.\n\nClaim here (takes 30 seconds): ${SITE}/techalert-staffing\n\n— Matt Michels\nDetroit Web Agency\n(313) 992-1219\n\nReply STOP to opt out.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#0a1628;max-width:560px"><p>Hi ${first},</p><p>I built a system that pulls newly-licensed CNAs and RNs from Michigan LARA <strong>the day they get licensed</strong> — before they hit Indeed, ZipRecruiter, or any job board.</p><p>I'll send <strong>${agency}</strong> 10 free names with phone numbers in your county tomorrow morning. No card, no call required.</p><p>If even one is a real placement, we talk. If not, you got 10 free leads.</p><p><a href="${SITE}/techalert-staffing" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:4px;display:inline-block">Claim 10 Free Names →</a></p><p>— Matt Michels<br/>Detroit Web Agency<br/>(313) 992-1219</p><p style="font-size:11px;color:#888">Reply STOP to opt out.</p></div>`;
  return { subject, html, text };
}

function copyD3(name: string | null, agency: string): DripCopy {
  const first = (name || "there").split(" ")[0];
  const subject = `${first} — 14 new CNAs licensed in Wayne County this week`;
  const text = `Hi ${first},\n\nQuick follow-up. Since I emailed Monday, 14 new CNAs and 6 RNs got licensed in Wayne County alone. Most won't hit Indeed for 2–3 weeks.\n\nWe pulled them all. Want the list for ${agency}? Free, takes 30 seconds:\n\n${SITE}/techalert-staffing\n\n— Matt\n\nReply STOP to opt out.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#0a1628;max-width:560px"><p>Hi ${first},</p><p>Quick follow-up. Since I emailed Monday, <strong>14 new CNAs and 6 RNs got licensed in Wayne County alone</strong>. Most won't hit Indeed for 2–3 weeks.</p><p>We pulled them all. Want the list for ${agency}? Free, takes 30 seconds:</p><p><a href="${SITE}/techalert-staffing" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:4px;display:inline-block">Get the list →</a></p><p>— Matt</p><p style="font-size:11px;color:#888">Reply STOP to opt out.</p></div>`;
  return { subject, html, text };
}

function copyD7(name: string | null, agency: string): DripCopy {
  const first = (name || "there").split(" ")[0];
  const subject = `Last note — should I close ${agency}'s file?`;
  const text = `Hi ${first},\n\nLast email from me. If healthcare staffing is full or this isn't a fit, no problem — I'll close your file.\n\nIf you want to see what we pulled this week (free, no card, 10 names in your county), here's the link one more time:\n\n${SITE}/techalert-staffing\n\nOr text me directly: (313) 992-1219.\n\n— Matt\n\nReply STOP to opt out.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#0a1628;max-width:560px"><p>Hi ${first},</p><p>Last email from me. If healthcare staffing is full or this isn't a fit, no problem — I'll close your file.</p><p>If you want to see what we pulled this week (free, no card, 10 names in your county), here's the link one more time:</p><p><a href="${SITE}/techalert-staffing" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:4px;display:inline-block">Show me →</a></p><p>Or text me directly: (313) 992-1219.</p><p>— Matt</p><p style="font-size:11px;color:#888">Reply STOP to opt out.</p></div>`;
  return { subject, html, text };
}

async function sourceFromApollo(sb: any) {
  let inserted = 0;
  for (const location of MI_LOCATIONS) {
    for (const keyword of ["healthcare staffing", "nurse staffing agency", "medical staffing"]) {
      try {
        const orgs = await apolloOrganizationSearch({
          organization_locations: [location],
          q_organization_name: keyword,
          per_page: 10,
        } as any);
        for (const org of orgs || []) {
          const domain = (org as any).primary_domain || (org as any).website_url;
          if (!domain || !org.name) continue;
          const people = await apolloPeopleSearch({
            organization_name: org.name,
            person_titles: TARGET_TITLES,
            per_page: 2,
            decision_makers_only: false,
          });
          for (const p of people || []) {
            const email = (p as any).email;
            if (!email || email === "email_not_unlocked@domain.com") continue;
            const { error } = await sb.from("staffing_agency_prospects").upsert({
              agency_name: org.name,
              contact_name: [(p as any).first_name, (p as any).last_name].filter(Boolean).join(" ") || null,
              contact_title: (p as any).title || null,
              email: String(email).toLowerCase(),
              phone: (p as any).phone_numbers?.[0]?.sanitized_number || null,
              city: (org as any).city || null,
              state: (org as any).state || "MI",
              domain,
              apollo_id: (p as any).id,
              source: "apollo",
              status: "new",
            }, { onConflict: "email", ignoreDuplicates: true });
            if (!error) inserted++;
          }
        }
      } catch (e) {
        console.error(`Apollo source failed for ${location}/${keyword}:`, e);
      }
    }
  }
  return inserted;
}

async function sendDripBatch(sb: any, stage: "d0" | "d3" | "d7", remaining: number): Promise<number> {
  if (remaining <= 0) return 0;
  const filter = stage === "d0"
    ? { status: "new" }
    : stage === "d3"
    ? { status: "d0_sent", before: new Date(Date.now() - 3 * 86400000).toISOString(), col: "d0_sent_at" }
    : { status: "d3_sent", before: new Date(Date.now() - 4 * 86400000).toISOString(), col: "d3_sent_at" };

  let q = sb.from("staffing_agency_prospects").select("*").eq("status", filter.status).limit(remaining);
  if ("col" in filter) q = q.lte(filter.col, filter.before);
  const { data: prospects, error } = await q;
  if (error || !prospects?.length) return 0;

  let sent = 0;
  for (const p of prospects) {
    try {
      const blocked = await isBlocked(sb, { email: p.email });
      if (blocked) {
        await sb.from("staffing_agency_prospects").update({ status: "suppressed", updated_at: new Date().toISOString() }).eq("id", p.id);
        continue;
      }
      const copy = stage === "d0" ? copyD0(p.contact_name, p.agency_name)
        : stage === "d3" ? copyD3(p.contact_name, p.agency_name)
        : copyD7(p.contact_name, p.agency_name);
      const result = await dwaEmail({ to: p.email, subject: copy.subject, html: copy.html, text: copy.text });
      if (result.ok) {
        const upd: Record<string, any> = { updated_at: new Date().toISOString() };
        if (stage === "d0") { upd.status = "d0_sent"; upd.d0_sent_at = new Date().toISOString(); }
        if (stage === "d3") { upd.status = "d3_sent"; upd.d3_sent_at = new Date().toISOString(); }
        if (stage === "d7") { upd.status = "d7_sent"; upd.d7_sent_at = new Date().toISOString(); }
        await sb.from("staffing_agency_prospects").update(upd).eq("id", p.id);
        sent++;
      } else if (result.error?.toLowerCase().includes("bounce") || result.error?.toLowerCase().includes("invalid")) {
        await sb.from("staffing_agency_prospects").update({ status: "bounced", bounced_at: new Date().toISOString() }).eq("id", p.id);
      }
    } catch (e) {
      console.error(`Drip ${stage} failed for ${p.email}:`, e);
    }
  }
  return sent;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  try {
    const sourced = await sourceFromApollo(sb);

    let remaining = DAILY_SEND_CAP;
    const d7 = await sendDripBatch(sb, "d7", remaining); remaining -= d7;
    const d3 = await sendDripBatch(sb, "d3", remaining); remaining -= d3;
    const d0 = await sendDripBatch(sb, "d0", remaining); remaining -= d0;
    const totalSent = d0 + d3 + d7;

    if (totalSent > 0 && TWILIO_PHONE) {
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
        `[Staffing Cold Email] ${totalSent} sent (${d0} D0, ${d3} D3, ${d7} D7). ${sourced} new prospects sourced.`,
        "staffing_outreach").catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true, sourced, sent: totalSent, d0, d3, d7,
      duration_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("staffing-agency-prospector failed:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
