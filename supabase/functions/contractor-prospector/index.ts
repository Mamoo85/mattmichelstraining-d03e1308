import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (step: string, data?: any) =>
  console.log(`[CONTRACTOR-PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Daily send cap to protect domain reputation ──
const DAILY_SEND_CAP = 30;
const DEAD_LEAD_CAP = 5;      // dead lead reactivation pitches/day
const TECH_ALERT_CAP = 5;     // TechAlert trial pitches/day
const MISSED_CALL_CAP = 5;    // Missed-Call Text-Back pitches/day

// ── Metro Detroit targets only ──
const TRADES = ["roofer", "HVAC contractor", "plumber", "electrician", "dentist"];
const DEAD_LEAD_TRADES = new Set(["roofer", "HVAC contractor", "plumber", "electrician"]);
const CITIES = [
  "Grosse Pointe MI", "Detroit MI", "Warren MI", "Sterling Heights MI",
  "Troy MI", "Livonia MI", "Dearborn MI", "Royal Oak MI",
  "St. Clair Shores MI", "Macomb MI", "Ferndale MI",
];

// Pick 2 trade+city combos to run today (rotated by day of year)
function getTodaysCombos(): { trade: string; city: string }[] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const combos: { trade: string; city: string }[] = [];
  for (const trade of TRADES) {
    for (const city of CITIES) {
      combos.push({ trade, city });
    }
  }
  const idx = (dayOfYear * 2) % combos.length;
  return [combos[idx], combos[(idx + 1) % combos.length]];
}

function scoreGbp(place: any): { score: number; issues: string[] } {
  let score = 0;
  const issues: string[] = [];
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || 0;

  if (!place.websiteUri) { score += 30; issues.push("no website"); }
  if (reviewCount < 10) { score += 25; issues.push(`only ${reviewCount} reviews`); }
  else if (reviewCount < 25) { score += 10; issues.push(`low review count (${reviewCount})`); }
  if (rating < 4.0 && rating > 0) { score += 20; issues.push(`${rating}-star rating`); }
  if (!place.nationalPhoneNumber) { score += 15; issues.push("no phone listed"); }

  return { score: Math.min(score, 95), issues };
}

function pickOffer(trade: string, issues: string[]): { offer: string; pitch: string; price: string } {
  const isTrade = trade !== "dentist";
  const hasLowReviews = issues.some(i => i.includes("review"));
  const hasLowRating = issues.some(i => i.includes("star"));

  if (hasLowReviews || issues.some(i => i.includes("no website"))) {
    return { offer: "gbp", pitch: "Google Business Profile Management", price: "$199/mo" };
  }
  if (isTrade && hasLowRating) {
    return { offer: "missed_call", pitch: "Missed-Call Text Back", price: "$99/mo" };
  }
  return { offer: "leads", pitch: "Exclusive Local Leads", price: "$399/mo" };
}

async function searchGoogleMaps(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.id",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
  });
  if (!res.ok) throw new Error(`Google Maps error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.places || [];
}

async function scrapeEmail(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const res = await fetch(websiteUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract the website's own domain for preference matching
    let siteDomain = "";
    try { siteDomain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase(); } catch {}

    const BLOCKLIST = [
      "example.com","google.com","facebook.com","wix.com","squarespace.com","sentry.io","w3.org",
      "wixpress.com","sentry-next","domain.com","yoursite.com","yourdomain.com","test.com",
      "placeholder","wordpress.com","wordpress.org","github.com","jsdelivr","googleapis.com",
      "gstatic.com","cloudflare","schema.org","gravatar.com","fontawesome","astigmatic.com",
      "impallari","googleusercontent.com","creativecommons.org","mozilla.org","apple.com",
      "microsoft.com","twitter.com","instagram.com","linkedin.com","youtube.com","tiktok.com",
      "pinterest.com","yelp.com","bbb.org","angieslist.com","homeadvisor.com","thumbtack.com",
    ];

    const BLOCKED_PREFIXES = [
      "user@","admin@","test@","noreply@","no-reply@","webmaster@","postmaster@","info@example",
      "support@example","name@","email@","someone@","nobody@","null@","root@","daemon@",
    ];

    const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => {
        const l = e.toLowerCase();
        // Block known junk domains
        if (BLOCKLIST.some(d => l.includes(d))) return false;
        // Block file extensions
        if (/\.(png|jpg|svg|js|css|gif|webp|woff|ttf|eot)$/i.test(l)) return false;
        // Block unreasonable length
        if (l.length > 60 || l.length < 6) return false;
        // Block hash-like local parts (tracking pixels, CSS fonts)
        const localPart = l.split("@")[0];
        if (localPart.length > 20 && /[0-9a-f]{8,}/.test(localPart)) return false;
        // Block generic prefixes
        if (BLOCKED_PREFIXES.some(p => l.startsWith(p))) return false;
        // Must end with common TLD
        if (!/\.(com|net|org|biz|us|co|io|info|email)$/.test(l)) return false;
        return true;
      });

    if (!emails.length) return null;

    // Prefer emails matching the website's own domain
    if (siteDomain) {
      const domainMatch = emails.find(e => e.toLowerCase().endsWith(`@${siteDomain}`));
      if (domainMatch) return domainMatch;
    }

    // Prefer common business prefixes
    const businessPrefixes = ["info@","contact@","office@","hello@","sales@","service@","mail@"];
    const bizMatch = emails.find(e => businessPrefixes.some(p => e.toLowerCase().startsWith(p)));
    if (bizMatch) return bizMatch;

    return emails[0];
  } catch { return null; }
}

// ── AGENT 1: THE SCOUT — AI Lead Qualification ──
// Scores each lead 1-10. Only leads scoring 7+ get emailed.
async function scoutScoreLead(
  businessName: string,
  trade: string,
  city: string,
  rating: number,
  reviewCount: number,
  hasWebsite: boolean,
  hasPhone: boolean,
  issues: string[],
): Promise<{ score: number; reasoning: string; bestOffer: string }> {
  const prompt = `You are the SCOUT — an AI lead qualification agent for Matt Michels, a local business automation consultant in Grosse Pointe, MI. You evaluate whether a local business is worth cold-emailing.

Business: "${businessName}"
Trade: ${trade}
City: ${city}, MI
Google Rating: ${rating || "N/A"} stars
Review Count: ${reviewCount}
Has Website: ${hasWebsite ? "Yes" : "No"}
Has Phone Listed: ${hasPhone ? "Yes" : "No"}
GBP Issues Found: ${issues.join(", ") || "None"}

Score this lead 1-10 based on:
- Pain signals (low reviews, no website, bad rating = HIGH score, they need help)
- Reachability (has email/phone = better)
- Revenue potential (trades like roofers/HVAC have higher job values than others)
- Competition vulnerability (few reviews = easier to outrank)
- Likelihood to respond to cold outreach (small local businesses > chains)

A score of 7+ means "email this lead." Below 7 = skip.

Also pick the single best offer to pitch:
- "leads" ($399/mo exclusive local leads) — best for established contractors who want more volume
- "gbp" ($199/mo GBP management) — best for businesses with weak Google presence
- "missed_call" ($99/mo missed-call text back) — best for busy field workers who miss calls

Respond with ONLY a JSON object:
{"score": 8, "reasoning": "one sentence why", "bestOffer": "leads"}`;

  try {
    const text = await generateText(prompt, 200);
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.min(10, Math.max(1, parsed.score || 5)),
      reasoning: parsed.reasoning || "",
      bestOffer: parsed.bestOffer || "leads",
    };
  } catch (e) {
    log("Scout scoring failed, using fallback", { businessName, error: String(e) });
    // Fallback: use GBP score as proxy
    const fallbackScore = issues.length >= 3 ? 8 : issues.length >= 2 ? 7 : 5;
    return { score: fallbackScore, reasoning: "Fallback score based on GBP issues", bestOffer: "leads" };
  }
}

// ── AGENT 2: THE SNIPER — Hyper-Personalized Cold Email ──
// Writes a 4-sentence flaw-based cold email with a specific hook.
async function sniperGenerateEmail(
  businessName: string,
  trade: string,
  city: string,
  issues: string[],
  offer: { offer: string; pitch: string; price: string },
  scoutReasoning: string,
): Promise<{ subject: string; body: string }> {
  const cityShort = city.replace(" MI", "");
  const issueText = issues.length > 0 ? issues.join(", ") : "limited online presence";

  const prompt = `You are the SNIPER — a cold outreach copywriter for Matt Michels, a local business automation consultant in Grosse Pointe, MI.

Your job: write a hyper-personalized 4-sentence cold email that gets replies.

Target: "${businessName}" — a ${trade} in ${cityShort}, MI
Specific flaws found: ${issueText}
Scout's assessment: ${scoutReasoning}
Offer to pitch: ${offer.pitch} at ${offer.price}

SNIPER RULES:
1. EXACTLY 4 sentences. Not 3, not 5. Four.
2. Sentence 1: Call out a SPECIFIC flaw you found (not generic — reference their actual data)
3. Sentence 2: Agitate — what this flaw is costing them in real dollars or lost jobs
4. Sentence 3: Present the fix in one line — what Matt does and the price
5. Sentence 4: Soft CTA — reply or text (313) 992-1219
6. Start with "Hey —" (never "Dear" or "Hi [Name]")
7. Sign off "— Matt, Grosse Pointe"
8. Blue-collar tone. Like a text from a buddy who happens to know marketing.
9. NO buzzwords (leverage, synergy, optimize, revolutionize, etc.)
10. Subject line: Under 40 chars, feels like a text message, lowercase ok

Format:
SUBJECT: [subject line]
BODY:
[4-sentence email]`;

  const text = await generateText(prompt, 400);
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

  return {
    subject: subjectMatch?.[1]?.trim() || `quick thing about ${businessName}`,
    body: bodyMatch?.[1]?.trim() || text,
  };
}

function buildEmailHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
<tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
<tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
${htmlBody}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
<img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;vertical-align:middle;" alt="Matt">
<span style="margin-left:12px;font-size:13px;color:#334155;vertical-align:middle;"><strong>Matt Michels</strong> · Grosse Pointe, MI · (313) 992-1219</span>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
M2 Development · Grosse Pointe, MI
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── AGENT 3: SNIPER_DEAD — Dead Lead Reactivation Pitch ──
async function sniperDeadLeadEmail(
  businessName: string,
  trade: string,
  city: string,
  reviewCount: number,
  rating: number,
): Promise<{ subject: string; body: string }> {
  const cityShort = city.replace(" MI", "");
  const tradeClean = trade.replace(" contractor", "");
  const prompt = `You are writing a 4-sentence cold email from Matt Michels at Detroit Web Agency to the owner of "${businessName}", a ${tradeClean} in ${cityShort}, MI.

The offer: We SMS-drip their OLD dead estimates (homeowners who got a quote but never hired). They only pay $50 when a lead replies YES they still need the work. Zero monthly fee, zero risk.

They have ${reviewCount} Google reviews and a ${rating || "unknown"}-star rating — reference one of these facts to prove you looked them up.

Rules:
1. EXACTLY 4 sentences
2. Sentence 1: Prove you looked them up — mention their review count, rating, or city specifically
3. Sentence 2: "You've got dead estimates in your system that never turned into jobs. We text them for you."
4. Sentence 3: The deal — $50 only when a lead says YES they still need the work. Zero monthly fee.
5. Sentence 4: Soft CTA — reply to this email or text (313) 992-1219
6. Start with "Hey —" (never "Dear" or "Hi [Name]")
7. Sign off: "— Matt, Detroit Web Agency"
8. Conversational, blue-collar tone. Not salesy.
9. Subject line: Under 40 chars, lowercase ok

Format:
SUBJECT: [subject line]
BODY:
[4-sentence email]`;

  const text = await generateText(prompt, 400);
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);
  return {
    subject: subjectMatch?.[1]?.trim() || `your old ${tradeClean} quotes`,
    body: bodyMatch?.[1]?.trim() || text,
  };
}

function buildDeadLeadEmailHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
<tr><td style="background:#00d4ff;padding:3px 0;"></td></tr>
<tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
${htmlBody}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
<span style="font-size:13px;color:#334155;"><strong>Matt Michels</strong> · Detroit Web Agency · (313) 992-1219 · detroitwebagent.com</span>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
Detroit Web Agency · Grosse Pointe, MI
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── Check how many dead lead emails sent today ──
async function getDailyDeadLeadCount(sb: any): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("outreach_leads")
    .select("id", { count: "exact", head: true })
    .eq("offer_pitched", "dead_lead_reactivation")
    .gte("created_at", todayStart.toISOString());
  return count || 0;
}

// ── Check how many Missed-Call pitches sent today ──
async function getDailyMissedCallCount(sb: any): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("outreach_leads")
    .select("id", { count: "exact", head: true })
    .eq("offer_pitched", "missed_call")
    .gte("created_at", todayStart.toISOString());
  return count || 0;
}

// ── Check how many TechAlert pitches sent today ──
async function getDailyTechAlertCount(sb: any): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("outreach_leads")
    .select("id", { count: "exact", head: true })
    .eq("offer_pitched", "tech_alert")
    .gte("created_at", todayStart.toISOString());
  return count || 0;
}

// Pitch rotation by day-of-year: 0=dead lead, 1=tech alert, 2=missed call, 3=web design
function getTodayPitchRotation(): "dead_lead" | "tech_alert" | "missed_call" | "web_design" {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const r = dayOfYear % 4;
  return r === 0 ? "dead_lead" : r === 1 ? "tech_alert" : r === 2 ? "missed_call" : "web_design";
}

// Map trade → TechAlert target_roles
function getTargetRolesForTrade(trade: string): string[] {
  const t = trade.toLowerCase();
  if (t.includes("hvac")) return ["hvac_tech", "pipefitter"];
  if (t.includes("plumb")) return ["plumber", "pipefitter"];
  if (t.includes("electric")) return ["electrician"];
  if (t.includes("boiler") || t.includes("steam") || t.includes("mechanical")) return ["boiler_operator", "steam_engineer"];
  return [];
}

// ── AGENT 4: SNIPER_TECH — TechAlert cold pitch ──
async function sniperTechAlertEmail(
  businessName: string,
  trade: string,
  city: string,
  reviewCount: number,
): Promise<{ subject: string; body: string }> {
  const cityShort = city.replace(" MI", "");
  const tradeClean = trade.replace(" contractor", "");
  const prompt = `You are writing a 4-sentence cold email from Matt Michels at Detroit Web Agency to the owner of "${businessName}", a ${tradeClean} in ${cityShort}, MI.

The offer: TechAlert — a service that monitors Michigan's MIOSHA license database daily and texts them the moment a licensed ${tradeClean} technician becomes available in their area. $99/mo, cancel anytime. They're getting a free trial today — no card required.

They have ${reviewCount} Google reviews — reference this to prove you looked them up.

Rules:
1. EXACTLY 4 sentences
2. Sentence 1: Prove you found them specifically — mention their review count, trade, or city
3. Sentence 2: Mention hiring pain — good licensed ${tradeClean} techs are hard to find, and by the time you hear about one, they're already gone
4. Sentence 3: TechAlert scans Michigan's MIOSHA license DB daily — when a new tech gets licensed in your area, you get a text first. Free trial, no card.
5. Sentence 4: Soft CTA — reply to claim their trial or text (313) 992-1219
6. Start with "Hey —"
7. Sign off: "— Matt, Detroit Web Agency"
8. Conversational, direct. Not salesy.
9. Subject line: Under 40 chars

Format:
SUBJECT: [subject line]
BODY:
[4-sentence email]`;

  const text = await generateText(prompt, 400);
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);
  return {
    subject: subjectMatch?.[1]?.trim() || `finding ${tradeClean} techs in ${cityShort}`,
    body: bodyMatch?.[1]?.trim() || text,
  };
}

function buildTechAlertEmailHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f172a;border:1px solid #00d4ff30;border-radius:8px;overflow:hidden;">
<tr><td style="background:#00d4ff;padding:3px 0;"></td></tr>
<tr><td style="padding:8px 24px 4px;background:#0a1628;">
  <span style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#00d4ff;">⚡ TechAlert by Detroit Web Agency</span>
</td></tr>
<tr><td style="padding:16px 24px 24px;color:#e2e8f0;font-size:15px;line-height:1.8;background:#0f172a;">
${htmlBody}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #1e3a5f;">
<span style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong> · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a> · <a href="https://detroitwebagent.com" style="color:#00d4ff;text-decoration:none;">detroitwebagent.com</a></span>
</div>
</td></tr>
<tr><td style="background:#0a1628;padding:12px 24px;border-top:1px solid #1e3a5f;font-size:11px;color:#475569;">
Detroit Web Agency · Grosse Pointe, MI
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sniperMissedCallEmail(
  businessName: string,
  trade: string,
  city: string,
  reviewCount: number,
): Promise<{ subject: string; body: string }> {
  const cityShort = city.replace(" MI", "");
  const tradeClean = trade.replace(" contractor", "");
  const prompt = `You are writing a 4-sentence cold email from Matt Michels at Detroit Web Agency to the owner of "${businessName}", a ${tradeClean} in ${cityShort}, MI.

The offer: Missed-Call Text-Back — when a homeowner calls and the contractor misses it, we automatically text them back within 60 seconds so they don't call the next guy. $99/mo, cancel anytime.

They have ${reviewCount} Google reviews — reference this to prove you looked them up.

Rules:
1. EXACTLY 4 sentences
2. Sentence 1: Prove you found them specifically — mention their review count, trade, or city
3. Sentence 2: Every missed call is a job they're handing to a competitor. While they're on a job, a homeowner calls, gets voicemail, and calls the next plumber.
4. Sentence 3: For $99/mo we text every missed caller back in 60 seconds — "Thanks for calling ${businessName}, we'll call you right back." They stop calling around.
5. Sentence 4: Soft CTA — takes 5 minutes to set up, reply or text (313) 992-1219
6. Start with "Hey —"
7. Sign off: "— Matt, Detroit Web Agency"
8. Conversational, direct. Not salesy.
9. Subject line: Under 40 chars

Format:
SUBJECT: [subject line]
BODY:
[4-sentence email]`;

  const text = await generateText(prompt, 400);
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);
  return {
    subject: subjectMatch?.[1]?.trim() || `missed calls costing ${tradeClean}s in ${cityShort}`,
    body: bodyMatch?.[1]?.trim() || text,
  };
}

function buildMissedCallEmailHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
<tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
<tr><td style="padding:8px 24px 4px;background:#fff3ec;">
  <span style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#e8621a;">📞 Missed-Call Text-Back · Detroit Web Agency</span>
</td></tr>
<tr><td style="padding:16px 24px 24px;color:#334155;font-size:15px;line-height:1.8;">
${htmlBody}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
<span style="font-size:13px;color:#334155;"><strong>Matt Michels</strong> · Detroit Web Agency · <a href="tel:+13139921219" style="color:#e8621a;text-decoration:none;">(313) 992-1219</a> · <a href="https://detroitwebagent.com" style="color:#e8621a;text-decoration:none;">detroitwebagent.com</a></span>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
Detroit Web Agency · Grosse Pointe, MI
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── Check how many emails sent today from this domain ──
async function getDailySendCount(sb: any): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString())
    .like("template_name", "contractor_%");
  return count || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check daily volume cap
    const dailySent = await getDailySendCount(sb);
    const remainingCap = DAILY_SEND_CAP - dailySent;
    if (remainingCap <= 0) {
      log("Daily send cap reached", { dailySent, cap: DAILY_SEND_CAP });
      return new Response(
        JSON.stringify({ ok: true, skipped: "daily_cap_reached", dailySent, cap: DAILY_SEND_CAP }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check dead lead, TechAlert, and Missed-Call daily caps
    const deadLeadSentToday = await getDailyDeadLeadCount(sb);
    const techAlertSentToday = await getDailyTechAlertCount(sb);
    const missedCallSentToday = await getDailyMissedCallCount(sb);
    let deadLeadSent = deadLeadSentToday;
    let techAlertSent = techAlertSentToday;
    let missedCallSent = missedCallSentToday;
    const pitchRotation = getTodayPitchRotation();
    log("Pitch rotation today", { pitchRotation, deadLeadSent, techAlertSent, missedCallSent });

    // Optional manual override — allows dashboard to target a specific trade + city
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualTrade = body.target_trade as string | undefined;
    const manualCity = body.target_city as string | undefined;
    const combos = (manualTrade && manualCity) ? [{ trade: manualTrade, city: manualCity }] : getTodaysCombos();
    let totalEmailed = 0;
    let totalDeadLeadEmailed = 0;
    let totalFound = 0;
    let totalSkipped = 0;
    let totalScoutRejected = 0;
    const maxToSend = Math.min(15, remainingCap);

    for (const { trade, city } of combos) {
      log("Searching", { trade, city });
      const places = await searchGoogleMaps(`${trade} in ${city}`, GOOGLE_MAPS_API_KEY);
      totalFound += places.length;

      for (const place of places.slice(0, 10)) {
        const name = place.displayName?.text || "Unknown Business";
        const phone = place.nationalPhoneNumber || null;
        const website = place.websiteUri || null;
        const rating = place.rating || 0;
        const reviewCount = place.userRatingCount || 0;

        // Deduplicate
        const { data: existing } = await sb
          .from("outreach_leads")
          .select("id")
          .ilike("business_name", name)
          .ilike("city", city.replace(" MI", ""))
          .limit(1);

        if (existing && existing.length > 0) {
          totalSkipped++;
          continue;
        }

        // GBP scoring (fast, no AI)
        const { score: gbpScore, issues } = scoreGbp(place);

        // Get email from website
        let email: string | null = null;
        if (website) email = await scrapeEmail(website);

        if (!email) {
          // Insert as SMS-only lead
          const offer = pickOffer(trade, issues);
          const { error: smsInsertErr } = await sb.from("outreach_leads").insert({
            business_name: name,
            city: city.replace(" MI", ""),
            industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
            phone,
            website: website || null,
            status: "lead_found",
            channel: "sms",
            offer_pitched: offer.offer,
            notes: `GBP issues: ${issues.join(", ")}. GBP score: ${gbpScore}. No email found.`,
          });
          if (smsInsertErr) log("SMS lead insert failed", { name, error: smsInsertErr.message });
          totalSkipped++;
          continue;
        }

        // ── TECH ALERT PITCH: day 2 of 3-day rotation for trade contractors ──
        if (DEAD_LEAD_TRADES.has(trade) && pitchRotation === "tech_alert" && techAlertSent < TECH_ALERT_CAP) {
          let taSubject: string, taBody: string;
          try {
            ({ subject: taSubject, body: taBody } = await sniperTechAlertEmail(name, trade, city, reviewCount));
          } catch (taErr) {
            log("TechAlert sniper failed", { name, error: String(taErr) });
            taSubject = ""; taBody = "";
          }
          if (taSubject && taBody) {
            const taHtml = buildTechAlertEmailHtml(taBody);
            const taRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@detroitwebagent.com>",
                to: [email],
                bcc: ["matt@detroitwebagent.com"],
                subject: taSubject,
                html: taHtml,
              }),
            });
            if (taRes.ok) {
              // Log the outreach
              await sb.from("outreach_leads").insert({
                business_name: name,
                city: city.replace(" MI", ""),
                industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
                phone, email, website: website || null,
                status: "emailed", channel: "email",
                offer_pitched: "tech_alert",
                last_contact_date: new Date().toISOString().split("T")[0],
                drip_campaign_status: { d0_sent: true, d0_sent_at: new Date().toISOString() },
                notes: `TechAlert pitch. Reviews: ${reviewCount}, Rating: ${rating}`,
              });
              await sb.from("email_send_log" as any).insert({
                recipient_email: email, template_name: "contractor_tech_alert_d0",
                status: "sent", message_id: `ta_d0_${Date.now()}_${email}`,
              });

              // Auto-enroll as TechAlert trial — prospect gets a real alert tomorrow morning
              // They never see a paywall until their 72h trial expires
              const targetRoles = getTargetRolesForTrade(trade);
              const { data: existingTrial } = await sb
                .from("hire_alert_clients")
                .select("id")
                .eq("owner_email", email)
                .maybeSingle();
              if (!existingTrial) {
                await sb.from("hire_alert_clients").insert({
                  company_name: name,
                  owner_email: email,
                  owner_phone: phone || null,
                  target_roles: targetRoles,
                  active: false,
                  trial_status: "active",
                  trial_started_at: new Date().toISOString(),
                  notify_email: true,
                  notify_sms: false,
                });
                log("TechAlert trial auto-enrolled", { name, email, targetRoles });
              }

              techAlertSent++;
              log("TechAlert pitch sent", { name, email, city });
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
          }
        }

        // ── MISSED-CALL PITCH: day 3 of 4-day rotation ──
        if (DEAD_LEAD_TRADES.has(trade) && pitchRotation === "missed_call" && missedCallSent < MISSED_CALL_CAP) {
          let mcSubject: string, mcBody: string;
          try {
            ({ subject: mcSubject, body: mcBody } = await sniperMissedCallEmail(name, trade, city, reviewCount));
          } catch (mcErr) {
            log("MissedCall sniper failed", { name, error: String(mcErr) });
            mcSubject = ""; mcBody = "";
          }
          if (mcSubject && mcBody) {
            const mcHtml = buildMissedCallEmailHtml(mcBody);
            const mcRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@detroitwebagent.com>",
                to: [email],
                bcc: ["matt@detroitwebagent.com"],
                subject: mcSubject,
                html: mcHtml,
              }),
            });
            if (mcRes.ok) {
              await sb.from("outreach_leads").insert({
                business_name: name,
                city: city.replace(" MI", ""),
                industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
                phone, email, website: website || null,
                status: "emailed", channel: "email",
                offer_pitched: "missed_call",
                last_contact_date: new Date().toISOString().split("T")[0],
                drip_campaign_status: { d0_sent: true, d0_sent_at: new Date().toISOString() },
                notes: `Missed-Call pitch. Reviews: ${reviewCount}, Rating: ${rating}`,
              });
              await sb.from("email_send_log" as any).insert({
                recipient_email: email, template_name: "contractor_missed_call_d0",
                status: "sent", message_id: `mc_d0_${Date.now()}_${email}`,
              });
              missedCallSent++;
              log("Missed-Call pitch sent", { name, email, city });
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
          }
        }

        // ── DEAD LEAD PITCH: for trade contractors, send reactivation pitch ──
        if (DEAD_LEAD_TRADES.has(trade) && (pitchRotation === "dead_lead" || techAlertSent >= TECH_ALERT_CAP) && deadLeadSent < DEAD_LEAD_CAP) {
          let dlSubject: string, dlBody: string;
          try {
            ({ subject: dlSubject, body: dlBody } = await sniperDeadLeadEmail(name, trade, city, reviewCount, rating));
          } catch (dlErr) {
            log("DeadLead sniper failed", { name, error: String(dlErr) });
            // fall through to regular Scout flow
            dlSubject = ""; dlBody = "";
          }
          if (dlSubject && dlBody) {
            const dlHtml = buildDeadLeadEmailHtml(dlBody);
            const dlRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@detroitwebagent.com>",
                to: [email],
                bcc: ["matt@detroitwebagent.com"],
                subject: dlSubject,
                html: dlHtml,
              }),
            });
            if (dlRes.ok) {
              await sb.from("outreach_leads").insert({
                business_name: name,
                city: city.replace(" MI", ""),
                industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
                phone, email, website: website || null,
                status: "emailed", channel: "email",
                offer_pitched: "dead_lead_reactivation",
                last_contact_date: new Date().toISOString().split("T")[0],
                drip_campaign_status: { d0_sent: true, d0_sent_at: new Date().toISOString() },
                notes: `Dead lead pitch. Reviews: ${reviewCount}, Rating: ${rating}`,
              });
              await sb.from("email_send_log" as any).insert({
                recipient_email: email, template_name: "contractor_dead_lead_d0",
                status: "sent", message_id: `dl_d0_${Date.now()}_${email}`,
              });
              deadLeadSent++;
              totalDeadLeadEmailed++;
              log("Dead lead pitch sent", { name, email, city });
              await new Promise(r => setTimeout(r, 500));
              continue; // skip regular SNIPER flow for this contractor
            }
          }
        }

        // ── SCOUT: AI lead qualification (score 1-10) ──
        const scout = await scoutScoreLead(
          name, trade, city.replace(" MI", ""),
          rating, reviewCount,
          !!website, !!phone, issues,
        );
        log("Scout scored", { name, score: scout.score, reasoning: scout.reasoning });

        if (scout.score < 7) {
          // Below threshold — store as lead but don't email
          const { error: scoutInsertErr } = await sb.from("outreach_leads").insert({
            business_name: name,
            city: city.replace(" MI", ""),
            industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
            phone, email,
            website: website || null,
            status: "lead_found",
            channel: "email",
            offer_pitched: scout.bestOffer,
            notes: `Scout score: ${scout.score}/10 (below threshold). ${scout.reasoning}. GBP issues: ${issues.join(", ")}`,
          });
          if (scoutInsertErr) log("Scout-rejected lead insert failed", { name, error: scoutInsertErr.message });
          totalScoutRejected++;
          continue;
        }

        // Use Scout's offer recommendation
        const offer = pickOffer(trade, issues);
        // Override with Scout's recommendation if it differs
        const finalOffer = ["leads", "gbp", "missed_call"].includes(scout.bestOffer)
          ? { ...offer, offer: scout.bestOffer }
          : offer;

        // ── SNIPER: Hyper-personalized cold email ──
        let subject: string, body: string;
        try {
          ({ subject, body } = await sniperGenerateEmail(
            name, trade, city.replace(" MI", ""),
            issues, finalOffer, scout.reasoning,
          ));
        } catch (sniperErr) {
          log("Sniper failed — skipping lead", { name, error: String(sniperErr) });
          totalSkipped++;
          continue;
        }
        const html = buildEmailHtml(body);

        // Send
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@detroitwebagent.com>",
            to: [email],
            bcc: ["matthewmichels4@gmail.com"],
            subject,
            html,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text().catch(() => "no body");
          log("Email send failed", { name, email, status: emailRes.status, error: errBody });
          continue;
        }

        // Store lead with Scout + Sniper metadata
        const { error: leadInsertErr } = await sb.from("outreach_leads").insert({
          business_name: name,
          city: city.replace(" MI", ""),
          industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
          phone, email,
          website: website || null,
          status: "emailed",
          channel: "email",
          offer_pitched: finalOffer.offer,
          last_contact_date: new Date().toISOString().split("T")[0],
          notes: `Scout: ${scout.score}/10 — ${scout.reasoning}. GBP issues: ${issues.join(", ")}. Offer: ${finalOffer.pitch}`,
        });
        if (leadInsertErr) log("Emailed lead insert failed", { name, email, error: leadInsertErr.message });

        // Log send
        const { error: logInsertErr } = await sb.from("email_send_log" as any).insert({
          recipient_email: email,
          template_name: "contractor_drip_d0",
          status: "sent",
          message_id: `contractor_d0_${Date.now()}_${email}`,
        });
        if (logInsertErr) log("email_send_log insert failed", { email, error: logInsertErr.message });

        totalEmailed++;
        log("Emailed", { name, email, scoutScore: scout.score, offer: finalOffer.offer, city });

        // Throttle between sends
        await new Promise(r => setTimeout(r, 500));

        if (totalEmailed >= maxToSend) break;
      }
      if (totalEmailed >= maxToSend) break;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        found: totalFound,
        emailed: totalEmailed,
        deadLeadEmailed: totalDeadLeadEmailed,
        techAlertEmailed: techAlertSent - techAlertSentToday,
        skipped: totalSkipped,
        scoutRejected: totalScoutRejected,
        pitchRotation,
        dailySentBefore: dailySent,
        dailySentAfter: dailySent + totalEmailed,
        cap: DAILY_SEND_CAP,
        combos,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
