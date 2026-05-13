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
import { hunterFindEmail } from "../_shared/hunter.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";
const SNOV_CLIENT_ID = Deno.env.get("SNOV_CLIENT_ID") || "";
const SNOV_CLIENT_SECRET = Deno.env.get("SNOV_CLIENT_SECRET") || "";

// Snov.io OAuth + domain-search email lookup. Free tier ~50/mo.
async function snovFindEmail(domain: string): Promise<{ email: string; name: string | null } | null> {
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET || !domain) return null;
  try {
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_CLIENT_ID}&client_secret=${SNOV_CLIENT_SECRET}`,
      signal: AbortSignal.timeout(8000),
    });
    const tok = await tokenRes.json();
    const access = tok?.access_token;
    if (!access) return null;
    const r = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=all&limit=5&access_token=${access}`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const emails: any[] = j?.emails || j?.data?.emails || [];
    if (!emails.length) return null;
    const ownerTitles = ["owner", "president", "founder", "ceo", "director", "manager"];
    const pick = emails.find((e: any) => ownerTitles.some(t => (e.position || "").toLowerCase().includes(t))) || emails[0];
    if (!pick?.email) return null;
    return { email: String(pick.email).toLowerCase(), name: [pick.firstName, pick.lastName].filter(Boolean).join(" ") || null };
  } catch { return null; }
}

async function yelpSearchAgencies(location: string, term: string): Promise<any[]> {
  if (!YELP_API_KEY) return [];
  try {
    const r = await fetch(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=20`, {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.businesses || [];
  } catch { return []; }
}

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

// Fallback waterfall: Google Places + Yelp → Firecrawl scrape → Hunter → Snov → info@domain
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const MI_QUERIES = [
  "healthcare staffing agency in Detroit MI",
  "nurse staffing agency in Grand Rapids MI",
  "medical staffing agency in Lansing MI",
  "healthcare staffing in Ann Arbor MI",
  "nurse staffing in Warren MI",
  "medical staffing in Flint MI",
  "home health agency in Detroit MI",
  "assisted living in Detroit MI",
];
const YELP_LOCATIONS = ["Detroit, MI", "Grand Rapids, MI", "Lansing, MI", "Ann Arbor, MI", "Warren, MI", "Flint, MI"];
const YELP_TERMS = ["nurse staffing", "healthcare staffing", "home health agency", "assisted living"];

interface SourcedAgency { name: string; website: string | null; phone: string | null; address: string | null; source: string; }

async function fetchGooglePlaces(): Promise<SourcedAgency[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const out: SourcedAgency[] = [];
  for (const query of MI_QUERIES) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") console.log(`places ${query}: ${data.status} ${data.error_message || ""}`);
      for (const place of (data.results || []).slice(0, 10)) {
        try {
          const detRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,formatted_address&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(8000) });
          const det = (await detRes.json()).result || {};
          out.push({ name: det.name || place.name, website: det.website || null, phone: det.formatted_phone_number || null, address: det.formatted_address || place.formatted_address || null, source: "google_places" });
        } catch (e) { console.log(`place detail fail: ${(e as Error).message}`); }
      }
    } catch (e) { console.log(`places query fail ${query}: ${(e as Error).message}`); }
  }
  return out;
}

async function fetchYelp(): Promise<SourcedAgency[]> {
  const out: SourcedAgency[] = [];
  for (const loc of YELP_LOCATIONS) {
    for (const term of YELP_TERMS) {
      const biz = await yelpSearchAgencies(loc, term);
      for (const b of biz.slice(0, 8)) {
        out.push({ name: b.name, website: b.url || null, phone: b.phone || null, address: b.location?.display_address?.join(", ") || null, source: "yelp" });
      }
    }
  }
  return out;
}

async function resolveEmail(_name: string, website: string | null): Promise<{ email: string; contact_name: string | null; via: string }> {
  const domain = website ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null;
  if (website) {
    try {
      const c = await extractContactInfo(website);
      if (c?.email) return { email: c.email.toLowerCase(), contact_name: c.name || null, via: "firecrawl" };
    } catch { /* */ }
  }
  if (domain) {
    const h = await hunterFindEmail(domain);
    if (h?.email) return { email: h.email.toLowerCase(), contact_name: [h.first_name, h.last_name].filter(Boolean).join(" ") || null, via: "hunter" };
  }
  if (domain) {
    const s = await snovFindEmail(domain);
    if (s) return { email: s.email, contact_name: s.name, via: "snov" };
  }
  if (domain) return { email: `info@${domain}`, contact_name: null, via: "domain_fallback" };
  return { email: "", contact_name: null, via: "none" };
}

async function sourceFromAllFallbacks(sb: any): Promise<{ inserted: number; via: Record<string, number>; raw_found: number }> {
  const places = await fetchGooglePlaces();
  const yelps = await fetchYelp();
  const all = [...places, ...yelps];
  const seen = new Set<string>();
  const uniq = all.filter(a => { const k = `${a.name}|${a.phone || ""}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const via: Record<string, number> = {};
  let inserted = 0;
  for (const a of uniq) {
    try {
      const { email, contact_name, via: emailVia } = await resolveEmail(a.name, a.website);
      if (!email) continue;
      const domain = a.website ? a.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : email.split("@")[1];
      const { error } = await sb.from("staffing_agency_prospects").upsert({
        agency_name: a.name, contact_name, contact_title: null, email, phone: a.phone,
        city: (a.address || "").split(",")[1]?.trim() || null, state: "MI",
        domain, apollo_id: null, source: a.source, status: "new",
      }, { onConflict: "email", ignoreDuplicates: true });
      if (!error) { inserted++; via[`${a.source}+${emailVia}`] = (via[`${a.source}+${emailVia}`] || 0) + 1; }
      else console.log(`upsert err ${a.name}: ${error.message}`);
    } catch (e) { console.log(`upsert fail ${a.name}: ${(e as Error).message}`); }
  }
  return { inserted, via, raw_found: uniq.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  try {
    const apolloSourced = await sourceFromApollo(sb).catch(e => { console.log("apollo fail:", e.message); return 0; });
    const fallback = await sourceFromAllFallbacks(sb);
    const sourced = apolloSourced + fallback.inserted;

    let d0 = 0, d3 = 0, d7 = 0;
    if (!dryRun) {
      let remaining = DAILY_SEND_CAP;
      d7 = await sendDripBatch(sb, "d7", remaining); remaining -= d7;
      d3 = await sendDripBatch(sb, "d3", remaining); remaining -= d3;
      d0 = await sendDripBatch(sb, "d0", remaining); remaining -= d0;
    }
    const totalSent = d0 + d3 + d7;
    if (totalSent > 0 && TWILIO_PHONE) {
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE, `[Staffing Cold Email] ${totalSent} sent. ${sourced} new prospects sourced.`, "staffing_outreach").catch(() => {});
    }
    return new Response(JSON.stringify({
      ok: true, sourced, apollo_sourced: apolloSourced, fallback_sourced: fallback.inserted, raw_agencies_found: fallback.raw_found, via_breakdown: fallback.via,
      sent: totalSent, d0, d3, d7, dry_run: dryRun, duration_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("staffing-agency-prospector failed:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
