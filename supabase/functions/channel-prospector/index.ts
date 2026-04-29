// channel-prospector — channel-aware cold outreach (fax / postcard / sms)
// Statewide Michigan coverage with multi-query fan-out, 90-day re-pitch window,
// and admin-only gating. Mirrors contractor-prospector scaling.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { extractFaxNumber } from "../_shared/firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SINCH_PROJECT_ID = Deno.env.get("SINCH_PROJECT_ID") || "";
const SINCH_KEY_ID = Deno.env.get("SINCH_KEY_ID") || "";
const SINCH_KEY_SECRET = Deno.env.get("SINCH_KEY_SECRET") || "";
const FAX_FROM = Deno.env.get("SINCH_FAX_FROM") || ""; // optional Sinch-provisioned fax number, E.164
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";

// ── Daily caps (massively scaled up) ──
const CAPS: Record<string, number> = { fax: 80, postcard: 80, sms: 150 };
const PER_RUN_MAX = 50;
const REPITCH_DAYS = 90;

const OFFER_PITCHED: Record<string, string> = {
  fax: "fax_outreach",
  postcard: "postcard_outreach",
  sms: "sms_outreach",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DEFAULT_TRADES = ["roofer", "HVAC contractor", "plumber", "electrician"];

const MICHIGAN_CITIES = [
  "Detroit MI", "Warren MI", "Sterling Heights MI", "Troy MI", "Livonia MI", "Dearborn MI",
  "Royal Oak MI", "St. Clair Shores MI", "Macomb MI", "Ferndale MI", "Southfield MI",
  "Farmington Hills MI", "Novi MI", "Rochester Hills MI", "Pontiac MI", "Auburn Hills MI",
  "Birmingham MI", "Bloomfield Hills MI", "Canton MI", "Westland MI", "Taylor MI", "Wyandotte MI",
  "Monroe MI", "Ann Arbor MI", "Ypsilanti MI", "Saline MI", "Brighton MI", "Howell MI",
  "Lansing MI", "East Lansing MI", "Okemos MI", "Jackson MI", "Kalamazoo MI", "Battle Creek MI",
  "Portage MI", "Grand Rapids MI", "Wyoming MI", "Kentwood MI", "Holland MI", "Muskegon MI",
  "Grand Haven MI", "Saugatuck MI", "Flint MI", "Burton MI", "Saginaw MI", "Bay City MI",
  "Midland MI", "Mt. Pleasant MI", "Traverse City MI", "Petoskey MI", "Cadillac MI",
  "Alpena MI", "Marquette MI", "Sault Ste. Marie MI", "Escanaba MI", "Grosse Pointe MI",
];

const TRADE_QUERY_VARIANTS: Record<string, string[]> = {
  "roofer": ["roofer", "roofing contractor", "roof repair", "roof replacement"],
  "HVAC contractor": ["HVAC contractor", "heating and cooling", "AC repair", "furnace repair"],
  "plumber": ["plumber", "plumbing service", "drain cleaning", "emergency plumber"],
  "electrician": ["electrician", "electrical contractor", "electrical repair"],
};

function canonicalTrade(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("roof")) return "roofer";
  if (lower.includes("hvac") || lower.includes("heating") || lower.includes("ac repair") || lower.includes("furnace")) return "HVAC contractor";
  if (lower.includes("plumb") || lower.includes("drain")) return "plumber";
  if (lower.includes("electric")) return "electrician";
  return q;
}

function pickRandomCities(n: number): string[] {
  const shuffled = [...MICHIGAN_CITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// Fallback used only if prospector_targets table is empty or unreachable
const FALLBACK_TARGETS = [
  { city: "Detroit", state: "MI", trade: "roofer" },
  { city: "Detroit", state: "MI", trade: "HVAC contractor" },
  { city: "Warren", state: "MI", trade: "plumber" },
  { city: "Troy", state: "MI", trade: "electrician" },
];

async function getActiveTargets(sb: ReturnType<typeof createClient>): Promise<Array<{ city: string; state: string; trade: string }>> {
  try {
    const { data, error } = await (sb.from as any)("prospector_targets")
      .select("city, state, trade")
      .eq("active", true)
      .order("state").order("city").order("trade");
    if (error || !data?.length) return FALLBACK_TARGETS;
    return data as Array<{ city: string; state: string; trade: string }>;
  } catch {
    return FALLBACK_TARGETS;
  }
}

function pickTarget(targets: Array<{ city: string; state: string; trade: string }>): { trade: string; city: string } {
  const day = Math.floor(Date.now() / 86400000);
  const t = targets[day % targets.length];
  return { trade: t.trade, city: `${t.city} ${t.state}` };
}

async function searchGoogleMaps(q: string): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`);
    const j = await r.json().catch(() => ({}));
    return j.results || [];
  } catch (_) { return []; }
}

// DataForSEO Local Pack: returns businesses from SERP local results.
// Surfaces contractors that don't rank in Google Places but appear in map pack.
// Deduplicated against Google Maps results by name before use.
async function searchDataForSEO(trade: string, city: string): Promise<any[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return [];
  try {
    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const payload = [{
      keyword: `${trade} ${city}`,
      location_name: city.includes(",") ? city : `${city}, United States`,
      language_name: "English",
      depth: 10,
    }];
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/local_pack/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.tasks?.[0]?.result?.[0]?.items || [];
    // Normalize to same shape as Google Places results
    return items
      .filter((item: any) => item?.type === "local_pack" && item?.title)
      .map((item: any) => ({
        name: item.title,
        formatted_address: item.address || "",
        international_phone_number: item.phone || "",
        website: item.domain ? `https://${item.domain}` : "",
        place_id: null, // DataForSEO doesn't give Google place_id
        _source: "dataforseo",
      }));
  } catch (e) {
    console.error("[prospector] dataforseo error:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function getPlaceDetails(placeId: string): Promise<any> {
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,address_components&key=${GOOGLE_MAPS_API_KEY}`);
    const j = await r.json().catch(() => ({}));
    return j.result || {};
  } catch (_) { return {}; }
}

// Fax extraction waterfall: Firecrawl structured scrape → raw HTML regex → null
async function scrapeFax(website: string): Promise<string | null> {
  // Tier 1: Firecrawl (tries contact, contact-us, then homepage — labeled fax patterns)
  const firecrawlResult = await extractFaxNumber(website);
  if (firecrawlResult) return firecrawlResult;

  // Tier 2: raw fetch + regex fallback (faster, less accurate)
  try {
    const r = await fetch(website, { signal: AbortSignal.timeout(8_000) });
    const html = (await r.text()).toLowerCase();
    const patterns = [
      /fax[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/,
      /facsimile[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/,
      /f\.[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return `+1${m[1]}${m[2]}${m[3]}`;
    }
  } catch (_) {}
  return null;
}

async function scrapePhone(website: string): Promise<string | null> {
  try {
    const r = await fetch(website, { signal: AbortSignal.timeout(8000) });
    const html = await r.text();
    const m = html.match(/(?:tel:|phone[:\s]*)\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/i)
          || html.match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
    if (m) return `+1${m[1]}${m[2]}${m[3]}`;
  } catch (_) {}
  return null;
}

async function aiCopy(channel: string, name: string, trade: string, city: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return defaultCopy(channel, name, trade, city);
  const prompts: Record<string, string> = {
    fax: `Write a 1-page fax cover sheet (3 sentences, casual memo tone, like an internal bookkeeper note) to ${name}, a ${trade} in ${city}. Pitch: I'll hand them 5-15 exclusive homeowner leads/month for $399, no monthly contract. End with "Tear off & call (313) 992-1219 — Matt, Detroit Web Agency". No salutation, no signature block, no email.`,
    postcard: `Write the back of a 6x4 postcard (2 sentences max, bold and direct) to ${name}, a ${trade} in ${city}. Pitch: exclusive ${trade} leads in ${city}, $399/mo, scan QR to claim. End with "Matt — DetroitWebAgent.com". No greeting.`,
    sms: `Write a single SMS under 140 chars to ${name}, a ${trade} in ${city}. Pitch: I have 5-15 exclusive ${trade} homeowner leads/mo in ${city}, $399 flat. End with "Reply Y for details — Matt". No links (TCPA). No emoji.`,
  };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 400, messages: [{ role: "user", content: prompts[channel] }] }),
    });
    const j = await r.json();
    return j.content?.[0]?.text?.trim() || defaultCopy(channel, name, trade, city);
  } catch (_) {
    return defaultCopy(channel, name, trade, city);
  }
}

function defaultCopy(channel: string, name: string, trade: string, city: string): string {
  if (channel === "fax") return `MEMO TO: ${name}\n\nI run Detroit Web Agency. We have 5-15 exclusive homeowner ${trade} leads/mo in ${city} that need claiming. $399/mo flat, no contract.\n\nTear off & call (313) 992-1219 — Matt, Detroit Web Agency`;
  if (channel === "postcard") return `${name} — exclusive ${trade} leads in ${city}, $399/mo flat. Scan QR or call (313) 992-1219.\n\nMatt — DetroitWebAgent.com`;
  return `${name} — Matt at Detroit Web Agency. I have 5-15 exclusive ${trade} leads/mo in ${city}, $399 flat. Reply Y for details.`;
}

async function sendFax(toFax: string, body: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!SINCH_PROJECT_ID || !SINCH_KEY_ID || !SINCH_KEY_SECRET) {
    return { ok: false, err: "SINCH_PROJECT_ID/SINCH_KEY_ID/SINCH_KEY_SECRET not set" };
  }
  try {
    const auth = btoa(`${SINCH_KEY_ID}:${SINCH_KEY_SECRET}`);
    // Sinch Fax API v3 — multipart with a text/plain "body" file gets rendered to a fax page
    const fd = new FormData();
    fd.append("to", toFax);
    if (FAX_FROM) fd.append("from", FAX_FROM);
    fd.append("body", new Blob([body], { type: "text/plain" }), "memo.txt");
    const url = `https://fax.api.sinch.com/v3/projects/${SINCH_PROJECT_ID}/faxes`;
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, err: `Sinch ${r.status}: ${JSON.stringify(j)}` };
    return { ok: true, id: String(j.id || j.faxId || "") };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

async function sendPostcard(toAddr: any, frontText: string, backText: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!LOB_API_KEY) return { ok: false, err: "LOB_API_KEY not set" };
  try {
    const auth = btoa(`${LOB_API_KEY}:`);
    const front = `<html><body style="margin:0;padding:40px;font-family:Arial;background:#00d4ff;color:#0a1628;text-align:center;"><h1 style="font-size:48px;margin:0;">${frontText}</h1></body></html>`;
    const back = `<html><body style="margin:0;padding:40px;font-family:Arial;font-size:16px;line-height:1.5;">${backText.replace(/\n/g, "<br>")}</body></html>`;
    const fd = new FormData();
    fd.append("description", "DWA cold outreach");
    fd.append("to[name]", toAddr.name);
    fd.append("to[address_line1]", toAddr.line1);
    fd.append("to[address_city]", toAddr.city);
    fd.append("to[address_state]", toAddr.state);
    fd.append("to[address_zip]", toAddr.zip);
    fd.append("from", "adr_3a3deb8f8de87557");
    fd.append("front", front);
    fd.append("back", back);
    fd.append("size", "4x6");
    const r = await fetch("https://api.lob.com/v1/postcards", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    const j = await r.json();
    if (!r.ok) return { ok: false, err: JSON.stringify(j) };
    return { ok: true, id: String(j.id || "") };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

function parseAddr(_formatted: string, components: any[]): { line1: string; city: string; state: string; zip: string } | null {
  if (!components?.length) return null;
  const get = (type: string) => components.find(c => c.types?.includes(type))?.short_name || "";
  const line1 = `${get("street_number")} ${get("route")}`.trim();
  const city = get("locality");
  const state = get("administrative_area_level_1");
  const zip = get("postal_code");
  if (!line1 || !city || !state || !zip) return null;
  return { line1, city, state, zip };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Admin auth gate (verify_jwt=false in config so we check ourselves) ──
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const sbAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await sbAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const channel = (body.channel as string) || "sms";
  if (!["fax", "postcard", "sms"].includes(channel)) {
    return new Response(JSON.stringify({ ok: false, error: "channel must be fax|postcard|sms" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const cap = CAPS[channel];
  const offerKey = OFFER_PITCHED[channel];

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { count: sentToday } = await sb.from("outreach_leads" as any).select("id", { count: "exact", head: true }).eq("offer_pitched", offerKey).gte("created_at", dayStart.toISOString());
  const sentBefore = sentToday || 0;
  const remaining = cap - sentBefore;

  // ── Combo selection: DB-driven targets with manual override + All Michigan support ──
  const requestedTrade = (body.target_trade as string) || "";
  const requestedCity = (body.target_city as string) || "";
  const isAllMichigan = requestedCity === "All Michigan" || requestedCity === "all_michigan" || requestedCity === "🌎 All Michigan";

  let tradeForCopy: string;
  let cityList: string[];

  if (requestedTrade && requestedCity && !isAllMichigan) {
    tradeForCopy = canonicalTrade(requestedTrade);
    cityList = [requestedCity];
  } else if (isAllMichigan) {
    tradeForCopy = canonicalTrade(requestedTrade) || DEFAULT_TRADES[0];
    cityList = pickRandomCities(8);
  } else {
    const targets = await getActiveTargets(sb);
    const combo = pickTarget(targets);
    tradeForCopy = canonicalTrade(combo.trade);
    cityList = [combo.city];
  }

  if (remaining <= 0) {
    return new Response(JSON.stringify({ ok: true, channel, trade: tradeForCopy, city: cityList[0], found: 0, sent: 0, skipped: 0, failed: 0, cap, sentBefore, sentAfter: sentBefore, note: `Daily cap of ${cap} ${channel} sends already reached today. Resets at midnight.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Build query list (multi-query fan-out) ──
  const variants = TRADE_QUERY_VARIANTS[tradeForCopy] || [tradeForCopy];

  const queries: { q: string; city: string }[] = [];
  for (const c of cityList) {
    for (const v of variants) queries.push({ q: `${v} in ${c}`, city: c });
  }

  // Run Google Maps + DataForSEO in parallel batches of 4
  const allPlaces: { place: any; city: string }[] = [];
  for (let i = 0; i < queries.length; i += 4) {
    const batch = queries.slice(i, i + 4);
    const results = await Promise.all(batch.map(({ q, city }) =>
      Promise.all([
        searchGoogleMaps(q).then(places => places.map((p: any) => ({ place: p, city }))),
        searchDataForSEO(tradeForCopy, city).then(places => places.map((p: any) => ({ place: p, city }))),
      ]).then(([gp, dp]) => [...gp, ...dp])
    ));
    for (const r of results) allPlaces.push(...r);
  }

  // Dedupe: Google by place_id, DataForSEO by name (no place_id)
  const seenPlaceIds = new Set<string>();
  const seenNames = new Set<string>();
  const dedupedPlaces = allPlaces.filter(({ place }) => {
    const name = (place.name || "").toLowerCase().trim();
    if (place._source === "dataforseo") {
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    }
    if (!place.place_id || seenPlaceIds.has(place.place_id)) return false;
    seenPlaceIds.add(place.place_id);
    seenNames.add(name);
    return true;
  });

  const found = dedupedPlaces.length;
  const maxToSend = Math.min(PER_RUN_MAX, remaining);

  let sent = 0, skipped = 0, failed = 0;
  const sendErrors: string[] = [];
  const sentSamples: any[] = [];

  for (const { place: p, city: pCity } of dedupedPlaces) {
    if (sent >= maxToSend) break;

    // Re-pitch window: skip if pitched in the last 90 days
    const cutoff = new Date(Date.now() - REPITCH_DAYS * 86400000).toISOString();
    const { data: existing } = await sb.from("outreach_leads" as any)
      .select("id, last_contact_date")
      .eq("offer_pitched", offerKey)
      .eq("business_name", p.name)
      .gte("last_contact_date", cutoff)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    // DataForSEO results have no place_id — use pre-normalized fields directly
    const isDFS = p._source === "dataforseo";
    const details = isDFS ? p : await getPlaceDetails(p.place_id);
    const phone = details.international_phone_number || details.formatted_phone_number || "";
    const websiteRaw = details.website || "";

    let target: string | null = null;
    let toAddr: any = null;
    if (channel === "fax") {
      target = websiteRaw ? await scrapeFax(websiteRaw) : null;
      if (!target) { skipped++; continue; }
    } else if (channel === "postcard") {
      toAddr = parseAddr(details.formatted_address || "", details.address_components || []);
      if (!toAddr) { skipped++; continue; }
      toAddr.name = p.name;
    } else {
      // SMS: try Google phone first, fall back to website scrape
      // Normalize to strict E.164 (+1XXXXXXXXXX) — strip dashes, parens, spaces
      const normalize = (raw: string): string => {
        const digits = raw.replace(/[^\d]/g, "");
        if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
        if (digits.length === 10) return `+1${digits}`;
        return "";
      };
      let phoneClean = phone ? normalize(phone) : "";
      if (!phoneClean && websiteRaw) {
        const scraped = await scrapePhone(websiteRaw);
        phoneClean = scraped ? normalize(scraped) : "";
      }
      target = phoneClean || null;
      if (!target) { skipped++; continue; }
    }

    const copy = await aiCopy(channel, p.name, tradeForCopy, pCity);
    let result: { ok: boolean; id?: string; err?: string };
    if (channel === "fax") result = await sendFax(target!, copy);
    else if (channel === "postcard") result = await sendPostcard(toAddr, `Leads in ${pCity}`, copy);
    else result = await sendSMS(target!, "+13139921219", copy, "channel-prospector").then(
      (r: any) => ({ ok: !!r?.success, id: r?.sid, err: r?.error || (r?.suppressed ? "TCPA suppressed" : undefined) }),
    );

    if (!result.ok) {
      failed++;
      sendErrors.push(`${p.name}: ${result.err || "unknown"}`);
      continue;
    }

    await sb.from("outreach_leads" as any).insert({
      business_name: p.name,
      city: pCity,
      industry: tradeForCopy,
      phone: phone || null,
      offer_pitched: offerKey,
      status: "emailed",
      last_contact_date: new Date().toISOString(),
      drip_campaign_status: { d0_sent: true, d0_sent_at: new Date().toISOString(), channel, channel_target: target || (toAddr ? `${toAddr.line1}, ${toAddr.city} ${toAddr.state} ${toAddr.zip}` : ""), provider_id: result.id, copy },
      notes: `${channel.toUpperCase()} cold outreach — ${tradeForCopy}/${pCity}`,
    });
    sent++;
    sentSamples.push({ name: p.name, city: pCity, target: target || `${toAddr?.line1}`, copy: copy.slice(0, 120) });
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({
    ok: true,
    channel,
    combo: { trade: tradeForCopy, city: isAllMichigan ? `All Michigan (${cityList.length} cities)` : (requestedCity || auto.city) },
    citiesScanned: cityList,
    queryCount: queries.length,
    found, sent, skipped, failed,
    cap, sentBefore, sentAfter: sentBefore + sent,
    samples: sentSamples,
    errors: sendErrors.slice(0, 5),
    note: sent === 0
      ? (found === 0
          ? `Google Places returned 0 results across ${queries.length} queries (${cityList.length} cities × ${variants.length} variants). Check GOOGLE_MAPS_API_KEY.`
          : `Found ${found} unique businesses across ${cityList.length} cities but ${skipped} skipped (already pitched in last ${REPITCH_DAYS}d / no ${channel === "fax" ? "fax#" : channel === "postcard" ? "address" : "phone"} found) and ${failed} failed.`)
      : undefined,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
