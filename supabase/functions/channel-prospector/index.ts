// channel-prospector — channel-aware cold outreach (fax / postcard / sms)
// Mirrors the dead-lead pitch UX from contractor-prospector but sends via
// fax (Phaxio), postcard (Lob), or SMS (Twilio shared) instead of email.
// Logs each send to outreach_leads with channel-specific offer_pitched.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const PHAXIO_KEY = Deno.env.get("PHAXIO_API_KEY") || "";
const PHAXIO_SECRET = Deno.env.get("PHAXIO_API_SECRET") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

const CAPS: Record<string, number> = { fax: 20, postcard: 25, sms: 30 };
const OFFER_PITCHED: Record<string, string> = {
  fax: "fax_outreach",
  postcard: "postcard_outreach",
  sms: "sms_outreach",
};

const DEFAULT_TRADES = ["roofer", "HVAC contractor", "plumber", "electrician"];
const DEFAULT_CITIES = ["Detroit MI", "Warren MI", "Sterling Heights MI", "Troy MI", "Royal Oak MI", "Livonia MI"];

function todaysCombo(): { trade: string; city: string } {
  const day = Math.floor(Date.now() / 86400000);
  return {
    trade: DEFAULT_TRADES[day % DEFAULT_TRADES.length],
    city: DEFAULT_CITIES[Math.floor(day / DEFAULT_TRADES.length) % DEFAULT_CITIES.length],
  };
}

async function searchGoogleMaps(q: string): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`);
  const j = await r.json().catch(() => ({}));
  return j.results || [];
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,address_components&key=${GOOGLE_MAPS_API_KEY}`);
  const j = await r.json().catch(() => ({}));
  return j.result || {};
}

async function scrapeFax(website: string): Promise<string | null> {
  try {
    const r = await fetch(website, { signal: AbortSignal.timeout(8000) });
    const html = (await r.text()).toLowerCase();
    const m = html.match(/fax[:\s]*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
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
  if (!PHAXIO_KEY || !PHAXIO_SECRET) return { ok: false, err: "PHAXIO_API_KEY/SECRET not set" };
  try {
    const auth = btoa(`${PHAXIO_KEY}:${PHAXIO_SECRET}`);
    const fd = new FormData();
    fd.append("to", toFax);
    fd.append("string_data", body);
    fd.append("string_data_type", "text");
    const r = await fetch("https://api.phaxio.com/v2.1/faxes", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    const j = await r.json();
    if (!r.ok) return { ok: false, err: JSON.stringify(j) };
    return { ok: true, id: String(j.data?.id || "") };
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
    fd.append("from", "adr_3a3deb8f8de87557"); // default Lob from address; replace with real
    fd.append("front", front);
    fd.append("back", back);
    fd.append("size", "4x6");
    const r = await fetch("https://api.lob.com/v1/postcards", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    const j = await r.json();
    if (!r.ok) return { ok: false, err: JSON.stringify(j) };
    return { ok: true, id: String(j.id || "") };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

function parseAddr(formatted: string, components: any[]): { line1: string; city: string; state: string; zip: string } | null {
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

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const channel = (body.channel as string) || "sms";
  if (!["fax", "postcard", "sms"].includes(channel)) {
    return new Response(JSON.stringify({ ok: false, error: "channel must be fax|postcard|sms" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const cap = CAPS[channel];
  const offerKey = OFFER_PITCHED[channel];

  // Daily cap check
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { count: sentToday } = await sb.from("outreach_leads" as any).select("id", { count: "exact", head: true }).eq("offer_pitched", offerKey).gte("created_at", dayStart.toISOString());
  const sentBefore = sentToday || 0;
  const remaining = cap - sentBefore;

  const combo = (body.target_trade && body.target_city)
    ? { trade: body.target_trade, city: body.target_city }
    : todaysCombo();

  let found = 0, sent = 0, skipped = 0, failed = 0;
  const sendErrors: string[] = [];
  const sentSamples: any[] = [];

  if (remaining <= 0) {
    return new Response(JSON.stringify({ ok: true, channel, combo, found: 0, sent: 0, skipped: 0, failed: 0, cap, sentBefore, sentAfter: sentBefore, note: `Daily cap of ${cap} ${channel} sends already reached today. Resets at midnight.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const places = await searchGoogleMaps(`${combo.trade} in ${combo.city}`);
  found = places.length;

  for (const p of places.slice(0, Math.min(15, remaining))) {
    if (sent >= remaining) break;
    const placeId = p.place_id;
    if (!placeId) { skipped++; continue; }

    // Skip if already pitched on this channel
    const { data: existing } = await sb.from("outreach_leads" as any).select("id").eq("offer_pitched", offerKey).eq("business_name", p.name).maybeSingle();
    if (existing) { skipped++; continue; }

    const details = await getPlaceDetails(placeId);
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
      target = phone ? phone.replace(/\s/g, "") : null;
      if (!target || !target.startsWith("+1")) { skipped++; continue; }
    }

    const copy = await aiCopy(channel, p.name, combo.trade, combo.city);
    let result: { ok: boolean; id?: string; err?: string };
    if (channel === "fax") result = await sendFax(target!, copy);
    else if (channel === "postcard") result = await sendPostcard(toAddr, `Leads in ${combo.city}`, copy);
    else result = await sendSMS({ to: target!, body: copy, force: false }).then(
      (r: any) => ({ ok: !!r?.success, id: r?.sid, err: r?.error || (r?.suppressed ? "TCPA suppressed" : undefined) }),
    );

    if (!result.ok) {
      failed++;
      sendErrors.push(`${p.name}: ${result.err || "unknown"}`);
      continue;
    }

    await sb.from("outreach_leads" as any).insert({
      business_name: p.name,
      city: combo.city,
      industry: combo.trade,
      phone: phone || null,
      offer_pitched: offerKey,
      status: "emailed",
      last_contact_date: new Date().toISOString(),
      drip_campaign_status: { d0_sent: true, d0_sent_at: new Date().toISOString(), channel, channel_target: target || (toAddr ? `${toAddr.line1}, ${toAddr.city} ${toAddr.state} ${toAddr.zip}` : ""), provider_id: result.id, copy },
      notes: `${channel.toUpperCase()} cold outreach — ${combo.trade}/${combo.city}`,
    });
    sent++;
    sentSamples.push({ name: p.name, target: target || `${toAddr?.line1}`, copy: copy.slice(0, 120) });
    await new Promise(r => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({
    ok: true, channel, combo, found, sent, skipped, failed,
    cap, sentBefore, sentAfter: sentBefore + sent,
    samples: sentSamples,
    errors: sendErrors.slice(0, 5),
    note: sent === 0
      ? (found === 0 ? `Google Places returned 0 ${combo.trade} for ${combo.city}` : `Found ${found} but ${skipped} skipped (already pitched / no ${channel === "fax" ? "fax#" : channel === "postcard" ? "address" : "phone"} found) and ${failed} failed.`)
      : undefined,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
