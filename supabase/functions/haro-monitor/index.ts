// haro-monitor — daily cron, pulls HARO RSS feeds, filters for relevant topics,
// drafts a quote via Haiku, and SMSes Matt with the matching queries + pre-drafted reply.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "";

// HARO is now Connectively — free RSS still available per-category
const HARO_FEEDS = [
  "https://www.helpareporter.com/feeds/master",
  "https://www.helpareporter.com/feeds/hightech",
  "https://www.helpareporter.com/feeds/bizandfinance",
  "https://www.helpareporter.com/feeds/realestate",
];

// Keywords that match Matt's expertise areas
const RELEVANCE_KEYWORDS = [
  "contractor", "hvac", "roofing", "plumber", "electrician", "trade", "trades",
  "hiring", "labor shortage", "workforce", "staffing", "field service",
  "home improvement", "real estate", "fsbo", "loan officer", "mortgage",
  "small business", "lead generation", "automation", "text message marketing",
  "missed call", "web design", "local seo",
];

interface HaroItem {
  title: string;
  description: string;
  link: string;
  deadline?: string;
}

async function fetchFeed(url: string): Promise<HaroItem[]> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "DWA-HARO-Monitor/1.0 (matt@detroitwebagent.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items: HaroItem[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const block = match[1];
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] || "";
      const desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/)?.[1] || "";
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const deadline = desc.match(/deadline:?\s*([^\n<]+)/i)?.[1]?.trim() || "";
      if (title) items.push({ title, description: desc.replace(/<[^>]+>/g, " ").trim(), link, deadline });
    }
    return items;
  } catch {
    return [];
  }
}

function isRelevant(item: HaroItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw));
}

async function draftQuote(query: string): Promise<string> {
  const prompt = `Draft a 2-sentence HARO response from Matt Michels, owner of Detroit Web Agency (detroitwebagent.com). Matt's expertise: contractor lead generation, TechAlert (finds licensed trade workers before they post on job boards), Dead Lead Reactivation (texts old contractor leads), FieldDesk (field service dispatch), Mortgage Radar (FSBO/estate sale leads for LOs), missed-call text-back automation.

HARO query: "${query.slice(0, 400)}"

Write ONLY the 2-sentence quote. Specific, credible, quotable. No greeting, no sign-off.`;
  return generateWithHaiku(prompt, 150).catch(() => "Matt Michels, Detroit Web Agency — [draft your quote here]");
}

async function sms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !to) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: TWILIO_PHONE_NUMBER, To: to, Body: body }).toString(),
  }).catch(() => {});
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let matched = 0;

  try {
    const allItems = (await Promise.all(HARO_FEEDS.map(fetchFeed))).flat();
    const relevant = allItems.filter(isRelevant).slice(0, 5);

    for (const item of relevant) {
      const quote = await draftQuote(`${item.title}\n${item.description}`);
      const msg = `📰 HARO match: "${item.title.slice(0, 60)}"\nDeadline: ${item.deadline || "check link"}\n\nDraft quote:\n"${quote}"\n\nReply to: ${item.link || "haro.com"}`;

      if (ADMIN_PHONE) await sms(ADMIN_PHONE, msg);

      await sb.from("agent_heartbeats").upsert({
        agent_name: "haro-monitor",
        last_beat: new Date().toISOString(),
        status: "ok",
        metadata: { matched: relevant.length, last_title: item.title.slice(0, 80) },
      }, { onConflict: "agent_name" }).then(() => {});

      matched++;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (relevant.length === 0 && ADMIN_PHONE) {
      // Silent run — no SMS, just heartbeat
      await sb.from("agent_heartbeats").upsert({
        agent_name: "haro-monitor",
        last_beat: new Date().toISOString(),
        status: "ok",
        metadata: { matched: 0, total_scanned: allItems.length },
      }, { onConflict: "agent_name" });
    }

    return new Response(JSON.stringify({ ok: true, matched, total_scanned: allItems.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
