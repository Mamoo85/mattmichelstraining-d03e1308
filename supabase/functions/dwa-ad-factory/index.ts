// dwa-ad-factory — Weekly automated DWA animated HTML ad pipeline
//
// Runs every Monday 4am UTC (Sunday 11pm ET) via pg_cron.
// Rotates through 6 DWA products, one per week.
//
// Flow per product:
//   1. Pick this week's product (ISO week % 6)
//   2. Dedup — skip if already ran this week
//   3. Generate product-specific HTML animated ad (phone mockup format)
//   4. Upload HTML to Supabase Storage (public URL)
//   5. Call dwa-ad-renderer → Browserless records the animation → MP4
//   6. Call meta-ads-poster with the MP4 → Meta campaign created (PAUSED)
//   7. SMS Matt with Ads Manager link
//
// Format: 390×844 animated phone mockup — Hook → Product Demo → CTA
// (Same format as the manually-designed HTML ads in frontend/public/ads/)
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   BROWSERLESS_API_KEY (for HTML → MP4 rendering)
//   LOVABLE_API_KEY or OPENAI_API_KEY (for AI copy variations + TTS voiceover)
//   ADMIN_PHONE, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[DWA-AD-FACTORY] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Product definitions ───────────────────────────────────────────────────────

interface AdProduct {
  name: string;
  slug: string;           // used in filename + brandSlug for meta-ads-poster
  brandSlug: string;      // matches BRAND_CONFIG in meta-ads-poster
  price: string;
  trial: string;
  landingPath: string;
  utmCampaign: string;
  themeColor: string;     // CSS hex for accent
  themeBg: string;        // scene background
  icon: string;           // emoji for the product icon
  hookLine1: string;      // first hook text (red/accent, big)
  hookLine2: string;      // second hook text (white)
  hookLine3: string;      // small subtitle line
  demoScreens: string;    // what the phone app screen shows (for AI)
  finalHeadline: string;  // big headline on final CTA screen
  finalSub: string;       // supporting copy on final CTA
  ctaButton: string;      // CTA button label
  priceNote: string;      // fine print under button
  animDurationMs: number; // how long the animation runs before looping
}

const PRODUCTS: AdProduct[] = [
  {
    name: "Dead Lead Reactivation",
    slug: "dead-leads",
    brandSlug: "dwa-dead-leads",
    price: "$50",
    trial: "First campaign FREE",
    landingPath: "/ad/dead-leads",
    utmCampaign: "dead_leads_factory",
    themeColor: "#ff9f0a",
    themeBg: "#0d0a00",
    icon: "💰",
    hookLine1: "Your dead leads",
    hookLine2: "are worth real money.",
    hookLine3: "First reactivation campaign FREE →",
    demoScreens: "CRM showing old leads being reactivated, a text conversation where a cold lead replies and books",
    finalHeadline: "Dead Lead\nReactivation",
    finalSub: "We message your old leads and find the ones ready to buy now.",
    ctaButton: "Claim Your Free Campaign →",
    priceNote: "$50 per campaign after trial · No commitment",
    animDurationMs: 22000,
  },
  {
    name: "Missed-Call Catch",
    slug: "missed-call",
    brandSlug: "dwa-missed-call",
    price: "$99/mo",
    trial: "7-day free trial",
    landingPath: "/ad/missed-call",
    utmCampaign: "missed_call_factory",
    themeColor: "#0a84ff",
    themeBg: "#0a0a0a",
    icon: "📵",
    hookLine1: "You missed a call.",
    hookLine2: "They hired your\ncompetitor.",
    hookLine3: "Here's what happens instead →",
    demoScreens: "Incoming call screen → missed → auto-text fires in seconds → lead replies and books",
    finalHeadline: "Missed-Call\nCatch",
    finalSub: "Every missed call gets an instant auto-text. You never lose the lead.",
    ctaButton: "Try Free — 7 Days →",
    priceNote: "$99/month · Setup in 10 minutes",
    animDurationMs: 22000,
  },
  {
    name: "SiteRadar",
    slug: "site-radar",
    brandSlug: "dwa-site-radar",
    price: "$49/mo",
    trial: "7-day free trial",
    landingPath: "/ad/site-radar",
    utmCampaign: "site_radar_factory",
    themeColor: "#00d4ff",
    themeBg: "#0a1628",
    icon: "📡",
    hookLine1: "Companies visit\nyour site daily.",
    hookLine2: "You have no idea\nwho they are.",
    hookLine3: "SiteRadar shows you — try it free →",
    demoScreens: "Dashboard showing company names, industries, and contact info for anonymous website visitors arriving today",
    finalHeadline: "Site\nRadar",
    finalSub: "See every company that visited your website today — before they call your competitor.",
    ctaButton: "Start Free Trial →",
    priceNote: "$49/month · Cancel anytime",
    animDurationMs: 20000,
  },
  {
    name: "Trade Radar",
    slug: "trade-radar",
    brandSlug: "dwa-trade-radar",
    price: "$149/mo",
    trial: "7-day free trial",
    landingPath: "/ad/trade-radar",
    utmCampaign: "trade_radar_factory",
    themeColor: "#2ecc71",
    themeBg: "#050e08",
    icon: "📡",
    hookLine1: "Stop buying\nshared leads.",
    hookLine2: "Get yours.\nOnly yours.",
    hookLine3: "Trade Radar — Metro Detroit",
    demoScreens: "Phone lock screen push notification for a new lead 2 miles away, then app showing exclusive leads with Urgent and Exclusive badges",
    finalHeadline: "Trade\nRadar",
    finalSub: "Exclusive HVAC, roofing & plumbing leads in Metro Detroit. Never shared.",
    ctaButton: "Start Free Trial →",
    priceNote: "$149/month · No contracts",
    animDurationMs: 20000,
  },
  {
    name: "AI Phone Answering",
    slug: "ai-phone",
    brandSlug: "dwa-ai-phone",
    price: "$149/mo",
    trial: "7-day free trial",
    landingPath: "/start-here?product=ai_phone",
    utmCampaign: "ai_phone_factory",
    themeColor: "#bf5af2",
    themeBg: "#0d0014",
    icon: "📞",
    hookLine1: "While you're on the job,",
    hookLine2: "your phone loses\nyou customers.",
    hookLine3: "AI answers every call — 24/7 →",
    demoScreens: "Phone ringing while contractor is on a roof, AI assistant answering, booking an appointment, customer confirmation text sent",
    finalHeadline: "AI Phone\nAnswering",
    finalSub: "AI answers every call 24/7, books appointments, and qualifies leads — in your voice and tone.",
    ctaButton: "Try Free — 7 Days →",
    priceNote: "$149/month · One missed call pays for a month",
    animDurationMs: 22000,
  },
  {
    name: "Contractor Leads",
    slug: "contractor-leads",
    brandSlug: "dwa-contractor-leads",
    price: "$399/mo",
    trial: "Exclusive territory",
    landingPath: "/start-here?product=contractor_leads",
    utmCampaign: "contractor_leads_factory",
    themeColor: "#007aff",
    themeBg: "#0a0a14",
    icon: "⚒",
    hookLine1: "Angi just sent\nyour lead to\n5 other guys.",
    hookLine2: "We send it\nto you only.",
    hookLine3: "Exclusive contractor leads → Metro Detroit",
    demoScreens: "Split comparison: Angi lead sent to 5 contractors vs DWA exclusive lead sent to only you, then phone app showing fresh leads with EXCLUSIVE badge",
    finalHeadline: "Exclusive\nContractor\nLeads",
    finalSub: "Metro Detroit roofing, HVAC, plumbing & more. Never shared.",
    ctaButton: "Get 10 Free Leads →",
    priceNote: "$399/month after trial · Cancel anytime",
    animDurationMs: 24000,
  },
];

// ── ISO week number ───────────────────────────────────────────────────────────
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function thisWeekProduct(): AdProduct {
  const week = getISOWeek(new Date());
  return PRODUCTS[week % PRODUCTS.length];
}

// ── AI copy generation ────────────────────────────────────────────────────────
// Returns fresh hook + caption + CTA text so the ad reads differently each week
interface AdCopy {
  hookLine1: string;
  hookLine2: string;
  hookLine3: string;
  captionMoment1: string;  // caption shown during problem/pain moment
  captionMoment2: string;  // caption shown during solution reveal
  captionMoment3: string;  // caption shown right before CTA
  finalSub: string;
  ctaButton: string;
}

async function generateAdCopy(p: AdProduct): Promise<AdCopy> {
  const prompt = `Generate short, punchy copy for a 20-second animated social media ad for "${p.name}" by Detroit Web Agency.

Product: ${p.name} — ${p.price} (${p.trial})
Audience: local business owners, contractors, trades people in Metro Detroit
Tone: direct, confident, no fluff — like a trusted local advisor

Generate EXACTLY this JSON structure (no markdown, no explanation):
{
  "hookLine1": "first line — 4-6 words max, shows the PROBLEM. Use line breaks with \\n if needed.",
  "hookLine2": "second hook line — 4-6 words max, gut-punch that makes them keep watching",
  "hookLine3": "small subtitle — 5-8 words, hints at the solution or time frame",
  "captionMoment1": "caption shown during pain moment — 3-5 words, no punctuation except em dash",
  "captionMoment2": "caption shown during solution — 3-5 words, product name or key benefit",
  "captionMoment3": "caption just before CTA — 3-5 words, urgency or social proof",
  "finalSub": "1-2 sentences of supporting copy under the product name on final screen. Max 15 words.",
  "ctaButton": "CTA button text — 4-6 words, action-oriented, ends with →"
}`;

  const raw = await generateText(prompt, 400);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.hookLine1 && parsed.ctaButton) return parsed as AdCopy;
    }
  } catch { /* fall through to default */ }

  // Default copy if AI fails
  return {
    hookLine1: p.hookLine1,
    hookLine2: p.hookLine2,
    hookLine3: p.hookLine3,
    captionMoment1: "Sound familiar?",
    captionMoment2: `${p.name} fixes this`,
    captionMoment3: "Try it free today",
    finalSub: p.finalSub,
    ctaButton: p.ctaButton,
  };
}

// ── AI voiceover generation ───────────────────────────────────────────────────

async function generateNarrationScript(p: AdProduct, copy: AdCopy): Promise<string> {
  const durationSec = Math.round(p.animDurationMs / 1000);
  const prompt = `Write a ${durationSec}-second spoken voiceover script for a video ad for "${p.name}" by Detroit Web Agency.

Tone: Direct, confident, conversational. Local business owner audience — contractors, trades, small biz in Metro Detroit.
Timing: 4 beats — Hook (0-3s), Problem→Solution (3-${Math.round(durationSec * 0.45)}s), The Win (${Math.round(durationSec * 0.45)}-${Math.round(durationSec * 0.6)}s), CTA (${Math.round(durationSec * 0.6)}-${durationSec}s)
Use " — " for natural pauses. End on the call to action. No quotes, no labels, no markdown. Just the script.

Hook: ${copy.hookLine1.replace(/\n/g, ' ')} ${copy.hookLine2.replace(/\n/g, ' ')}
CTA: ${p.price}. ${p.trial}. Detroit Web Agency dot com.

Keep it under 60 words so it fits in ${durationSec} seconds at a deliberate pace.`;

  const script = await generateText(prompt, 150);
  // strip any accidental quotes or leading/trailing whitespace
  return script.replace(/^["']|["']$/g, '').trim();
}

async function generateVoiceover(
  script: string,
  openaiKey: string,
  // deno-lint-ignore no-explicit-any
  sb: any,
  productSlug: string,
  weekKey: string,
  supabaseUrl: string,
): Promise<string | null> {
  try {
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: script,
        voice: "onyx",          // deep authoritative male — B2B contractor audience
        response_format: "mp3",
        speed: 0.95,            // deliberate pacing to fill the full animation window
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      log("TTS error", { status: ttsRes.status, body: errText.slice(0, 200) });
      return null;
    }

    const mp3Bytes = new Uint8Array(await ttsRes.arrayBuffer());
    log("TTS generated", { bytes: mp3Bytes.byteLength });

    const mp3Path = `ad-voices/${productSlug}-${weekKey}.mp3`;
    const mp3Blob = new Blob([mp3Bytes], { type: "audio/mpeg" });
    const { error: uploadErr } = await sb.storage
      .from("ad-creatives")
      .upload(mp3Path, mp3Blob, { contentType: "audio/mpeg", upsert: true });

    if (uploadErr) {
      log("MP3 upload failed", { error: uploadErr.message });
      return null;
    }

    const audioUrl = `${supabaseUrl}/storage/v1/object/public/ad-creatives/${mp3Path}`;
    log("Voiceover saved", { audioUrl, bytes: mp3Bytes.byteLength });
    return audioUrl;
  } catch (e) {
    log("generateVoiceover error (non-fatal)", { error: String(e) });
    return null;
  }
}

// ── HTML ad generator ─────────────────────────────────────────────────────────
// Generates a complete animated HTML ad in the DWA phone-mockup format.
// Structure mirrors the manually-built ads (contractor-leads, trade-radar, etc.)
function generateHtmlAd(p: AdProduct, copy: AdCopy, audioUrl?: string | null): string {
  const landingUrl = `https://detroitwebagent.com${p.landingPath}?utm_source=meta&utm_medium=paid&utm_campaign=${p.utmCampaign}`;
  const tc = p.themeColor;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${p.name} — Detroit Web Agency</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background:${p.themeBg};
    display:flex; justify-content:center; align-items:center;
    min-height:100vh;
    font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;
  }

  .scene { width:390px; height:844px; background:${p.themeBg}; position:relative; overflow:hidden; }

  .hook-overlay {
    position:absolute; inset:0; z-index:80; background:${p.themeBg};
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:14px; padding:40px;
    opacity:0; transition:opacity .4s ease;
  }
  .hook-overlay.visible { opacity:1; }
  .hook-line {
    font-size:50px; font-weight:900; color:#fff;
    text-align:center; line-height:1.05; letter-spacing:-1px;
    opacity:0; transform:translateY(20px);
    transition:all .5s cubic-bezier(.34,1.2,.64,1);
  }
  .hook-line.in { opacity:1; transform:translateY(0); }
  .hook-line.accent { color:${tc}; }
  .hook-line.small { font-size:20px; font-weight:600; color:rgba(255,255,255,.45); margin-top:6px; }

  .phone-wrap {
    position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%);
    width:330px; height:714px;
    opacity:0; transition:opacity .5s ease; z-index:10;
  }
  .phone-wrap.visible { opacity:1; }
  .phone {
    width:100%; height:100%; background:#000;
    border-radius:44px; overflow:hidden; position:relative;
    box-shadow:0 0 0 10px #111, 0 0 0 12px #222, 0 30px 60px rgba(0,0,0,.9);
  }
  .sb {
    position:absolute; top:0; left:0; right:0; z-index:100;
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 24px 0; color:#fff; font-size:16px; font-weight:700;
  }
  .di {
    position:absolute; top:10px; left:50%;
    transform:translateX(-50%);
    width:120px; height:34px; background:#000; border-radius:18px; z-index:200;
  }

  /* App screen */
  .scr-app {
    position:absolute; inset:0; background:#f2f2f7;
    opacity:0; transition:opacity .4s ease; z-index:20;
  }
  .scr-app.visible { opacity:1; }

  .app-hdr {
    background:linear-gradient(135deg,${tc}cc,${tc}88);
    padding:52px 20px 18px; color:#fff;
  }
  .app-hdr-row { display:flex; align-items:center; justify-content:space-between; }
  .app-nm  { font-size:24px; font-weight:900; }
  .app-sub { font-size:14px; opacity:.7; margin-top:2px; }
  .live-pill {
    background:rgba(255,255,255,.2); border:1px solid rgba(255,255,255,.3);
    border-radius:20px; padding:5px 12px;
    font-size:13px; font-weight:800; display:flex; align-items:center; gap:6px;
  }
  .live-dot { width:8px; height:8px; border-radius:4px; background:#30d158; animation:lp 1.2s ease infinite; }
  @keyframes lp { 0%,100%{opacity:1} 50%{opacity:.2} }

  .leads-area { padding:14px; display:flex; flex-direction:column; gap:12px; }
  .sec-lbl { font-size:13px; font-weight:700; color:#8e8e93; text-transform:uppercase; letter-spacing:.6px; }

  .lead-card {
    background:#fff; border-radius:16px;
    padding:16px 14px;
    box-shadow:0 2px 8px rgba(0,0,0,.08);
    display:flex; align-items:center; gap:12px;
    opacity:0; transform:translateX(24px);
    transition:all .45s cubic-bezier(.34,1.1,.64,1);
    position:relative; overflow:hidden;
  }
  .lead-card.in { opacity:1; transform:translateX(0); }
  .lead-card.excl { border-left:4px solid ${tc}; }
  .lead-card.excl::after {
    content:'EXCLUSIVE'; position:absolute; top:8px; right:10px;
    background:${tc}; color:#fff; font-size:10px; font-weight:900;
    letter-spacing:.5px; padding:3px 8px; border-radius:6px;
  }
  .lead-av {
    width:48px; height:48px; border-radius:24px;
    background:rgba(128,128,128,.1);
    display:flex; align-items:center; justify-content:center;
    font-size:24px; flex-shrink:0;
  }
  .lead-nm   { font-size:19px; font-weight:800; color:#1c1c1e; }
  .lead-need { font-size:15px; color:#555; margin-top:2px; }
  .lead-tags { display:flex; gap:6px; margin-top:6px; }
  .tag { font-size:13px; font-weight:700; border-radius:7px; padding:3px 9px; }
  .tag-u { background:#fff0f0; color:#ff3b30; }
  .tag-d { background:#f0f4ff; color:#007aff; }

  .acc-btn {
    background:${tc}; border:none; border-radius:12px;
    padding:10px 16px; color:#fff; font-size:16px; font-weight:800;
    cursor:pointer; flex-shrink:0; transition:transform .15s ease;
  }
  .acc-btn.tap { transform:scale(.9); }

  /* Confirm */
  .scr-confirm {
    position:absolute; inset:0; background:#000;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:36px; gap:16px; text-align:center;
    opacity:0; transition:opacity .4s ease; z-index:26;
  }
  .scr-confirm.visible { opacity:1; }
  .check-ring {
    width:90px; height:90px; border-radius:45px;
    background:${tc}; display:flex; align-items:center; justify-content:center;
    font-size:44px; box-shadow:0 0 40px ${tc}66;
    transform:scale(0); transition:transform .5s cubic-bezier(.34,1.56,.64,1);
  }
  .check-ring.pop { transform:scale(1); }
  .conf-title { font-size:30px; font-weight:900; color:#fff; }
  .conf-sub   { font-size:17px; color:rgba(255,255,255,.5); line-height:1.5; }
  .conf-box {
    background:${tc}18; border:1.5px solid ${tc}44;
    border-radius:14px; padding:14px 18px; width:100%;
    opacity:0; transform:translateY(10px);
    transition:all .4s ease;
  }
  .conf-box.in { opacity:1; transform:translateY(0); }
  .conf-box-txt { font-size:22px; font-weight:900; color:${tc}; line-height:1.3; }

  /* Final */
  .scr-final {
    position:absolute; inset:0; background:${p.themeBg};
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:36px; gap:16px; text-align:center;
    opacity:0; transition:opacity .6s ease; z-index:30;
  }
  .scr-final.visible { opacity:1; }
  .final-icon  { font-size:60px; }
  .final-logo  { font-size:12px; font-weight:800; color:${tc}; letter-spacing:2px; text-transform:uppercase; }
  .final-title { font-size:44px; font-weight:900; color:#fff; letter-spacing:-1px; line-height:1.0; white-space:pre-line; }
  .final-sub   { font-size:17px; color:rgba(255,255,255,.5); line-height:1.5; }
  .final-stat {
    background:${tc}18; border:1.5px solid ${tc}44;
    border-radius:14px; padding:14px 20px; width:100%;
  }
  .final-stat-txt { color:${tc}; font-size:22px; font-weight:900; line-height:1.3; }
  .final-cta {
    background:${tc}; color:#fff; border:none;
    border-radius:16px; padding:18px; font-size:20px;
    font-weight:900; width:100%; cursor:pointer;
  }
  .final-price { color:rgba(255,255,255,.3); font-size:14px; }

  /* Caption */
  .caption {
    position:absolute; left:12px; right:12px; z-index:90;
    bottom:68px; pointer-events:none;
  }
  .cap-inner {
    background:rgba(0,0,0,.82); border-radius:16px;
    padding:16px 20px; text-align:center;
    opacity:0; transform:translateY(12px);
    transition:all .45s cubic-bezier(.34,1.2,.64,1);
  }
  .cap-inner.in { opacity:1; transform:translateY(0); }
  .cap-txt { color:#fff; font-size:26px; font-weight:800; line-height:1.3; }
  .cap-txt em { color:${tc}; font-style:normal; }
</style>
</head>
<body>
${audioUrl ? `<audio id="vo" autoplay playsinline preload="auto"
  src="${audioUrl}" style="position:absolute;width:0;height:0;opacity:0"></audio>` : ''}
<div class="scene">

  <div class="hook-overlay" id="hook">
    <div class="hook-line" id="h1">${copy.hookLine1.replace(/\n/g, "<br>")}</div>
    <div class="hook-line accent" id="h2">${copy.hookLine2.replace(/\n/g, "<br>")}</div>
    <div class="hook-line small" id="h3">${copy.hookLine3}</div>
  </div>

  <div class="phone-wrap" id="phone">
    <div class="phone">
      <div class="di"></div>
      <div class="sb"><span>9:41</span><div>▪▪▪▪ 📶 🔋</div></div>

      <div class="scr-app" id="scr-app">
        <div class="app-hdr">
          <div class="app-hdr-row">
            <div><div class="app-nm">${p.name}</div><div class="app-sub">Metro Detroit · Live</div></div>
            <div class="live-pill"><div class="live-dot"></div>LIVE</div>
          </div>
        </div>
        <div class="leads-area">
          <div class="sec-lbl">New — Today</div>
          <div class="lead-card excl" id="lc1">
            <div class="lead-av">${p.icon}</div>
            <div>
              <div class="lead-nm">Sarah M.</div>
              <div class="lead-need">Urgent request · Livonia</div>
              <div class="lead-tags"><span class="tag tag-u">Urgent</span><span class="tag tag-d">2.1 mi</span></div>
            </div>
            <button class="acc-btn" id="acc-btn">Accept</button>
          </div>
          <div class="lead-card excl" id="lc2">
            <div class="lead-av">${p.icon}</div>
            <div>
              <div class="lead-nm">Mike T.</div>
              <div class="lead-need">New job · Dearborn</div>
              <div class="lead-tags"><span class="tag tag-d">4.7 mi</span></div>
            </div>
            <button class="acc-btn">Accept</button>
          </div>
          <div class="lead-card excl" id="lc3">
            <div class="lead-av">${p.icon}</div>
            <div>
              <div class="lead-nm">Jennifer K.</div>
              <div class="lead-need">Ready to book · Westland</div>
              <div class="lead-tags"><span class="tag tag-d">6.3 mi</span></div>
            </div>
            <button class="acc-btn">Accept</button>
          </div>
        </div>
      </div>

      <div class="scr-confirm" id="scr-confirm">
        <div class="check-ring" id="checkmark">✓</div>
        <div class="conf-title">Accepted!</div>
        <div class="conf-sub">Auto-text sent to Sarah instantly. Nobody else got this.</div>
        <div class="conf-box" id="conf-box">
          <div class="conf-box-txt">Only you.\nEvery time. ✓</div>
        </div>
      </div>

      <div class="scr-final" id="scr-final">
        <div class="final-icon">${p.icon}</div>
        <div class="final-logo">Detroit Web Agency</div>
        <div class="final-title">${copy.finalSub.split('.')[0] || p.finalHeadline}</div>
        <div class="final-sub">${copy.finalSub}</div>
        <div class="final-stat"><div class="final-stat-txt">${p.trial}</div></div>
        <button class="final-cta" onclick="window.open('${landingUrl}')">${copy.ctaButton}</button>
        <div class="final-price">${p.priceNote}</div>
      </div>

      <div class="caption" id="caption">
        <div class="cap-inner" id="cap-inner">
          <div class="cap-txt" id="cap-txt"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
  const $ = id => document.getElementById(id);
  const show = id => $(id).classList.add('visible');
  const hide = id => $(id).classList.remove('visible');
  const fi   = id => $(id).classList.add('in');
  const fo   = id => $(id).classList.remove('in');
  function cap(html, on=true) { $('cap-txt').innerHTML=html; on?fi('cap-inner'):fo('cap-inner'); }

  function seq() {
    show('hook');
    setTimeout(()=>fi('h1'), 300);
    setTimeout(()=>fi('h2'), 1200);
    setTimeout(()=>fi('h3'), 2100);

    setTimeout(()=>{ hide('hook'); show('phone'); show('scr-app'); cap('${copy.captionMoment1}'); }, 3200);
    setTimeout(()=>fi('lc1'), 3700);
    setTimeout(()=>{ fi('lc2'); cap('<em>${copy.captionMoment2}</em>'); }, 4300);
    setTimeout(()=>fi('lc3'), 4900);

    setTimeout(()=>{ $('acc-btn').classList.add('tap'); cap('You claim it.'); }, 8000);
    setTimeout(()=>$('acc-btn').classList.remove('tap'), 8200);

    setTimeout(()=>{ hide('scr-app'); show('scr-confirm'); cap(''); }, 8700);
    setTimeout(()=>$('checkmark').classList.add('pop'), 9000);
    setTimeout(()=>{ fi('conf-box'); cap('<em>${copy.captionMoment3}</em>'); }, 10200);

    setTimeout(()=>{ hide('scr-confirm'); hide('phone'); cap('',false); show('scr-final'); }, 13500);

    setTimeout(()=>{
      ['hook','phone','scr-app','scr-confirm','scr-final'].forEach(hide);
      ['h1','h2','h3','lc1','lc2','lc3','conf-box'].forEach(fo);
      fo('cap-inner'); $('checkmark').classList.remove('pop');
      setTimeout(seq, 800);
    }, ${p.animDurationMs});
  }
  seq();
</script>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

  let body: { dryRun?: boolean; productIndex?: number; force?: boolean; useExisting?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sends empty body */ }

  const product = body.productIndex !== undefined
    ? PRODUCTS[body.productIndex % PRODUCTS.length]
    : thisWeekProduct();

  const isoWeek = getISOWeek(new Date());
  const weekKey = `${new Date().getUTCFullYear()}-W${String(isoWeek).padStart(2, "0")}`;

  log("Factory run", { product: product.name, weekKey, dryRun: body.dryRun });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Dedup ────────────────────────────────────────────────────────────────
  if (!body.force) {
    const { data: existing } = await sb
      .from("meta_ad_campaigns")
      .select("id, campaign_id, ads_manager_url")
      .eq("brand_slug", product.brandSlug)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) {
      log("Dedup: already ran this week", { product: product.name, campaignId: existing.campaign_id });
      return json({
        skipped: true,
        reason: "already submitted this week",
        product: product.name,
        existingCampaignId: existing.campaign_id,
        adsManagerUrl: existing.ads_manager_url,
        tip: "Pass force:true to override dedup",
      });
    }
  }

  // ── Generate AI copy ─────────────────────────────────────────────────────
  log("Generating AI copy for", { product: product.name });
  const copy = await generateAdCopy(product);
  log("Copy generated", { hookLine1: copy.hookLine1 });

  // ── Generate narration script (shared by dryRun + full run) ─────────────
  log("Generating narration script");
  const narrationScript = await generateNarrationScript(product, copy);
  log("Narration script", { script: narrationScript });

  // ── Dry run ──────────────────────────────────────────────────────────────
  if (body.dryRun) {
    const html = generateHtmlAd(product, copy, null);
    return json({
      dryRun: true,
      weekKey,
      product: product.name,
      brandSlug: product.brandSlug,
      copy,
      voiceoverScript: narrationScript,
      htmlLength: html.length,
      animDurationMs: product.animDurationMs,
      landingUrl: `https://detroitwebagent.com${product.landingPath}`,
      format: "390×844 animated phone mockup with AI voiceover (HTML → Browserless MP4 → Meta PAUSED campaign)",
      nextStep: "Remove dryRun to generate HTML + voiceover, render to MP4, and create Meta campaign",
    });
  }

  // ── Generate AI voiceover ─────────────────────────────────────────────────
  let audioUrl: string | null = null;
  if (OPENAI_KEY) {
    log("Generating voiceover via OpenAI TTS");
    audioUrl = await generateVoiceover(narrationScript, OPENAI_KEY, sb, product.slug, weekKey, SUPABASE_URL);
    if (audioUrl) {
      log("Voiceover ready", { audioUrl });
    } else {
      log("Voiceover failed (continuing without audio — captions still present)");
    }
  } else {
    log("OPENAI_API_KEY not set — skipping voiceover (captions still present in ad)");
  }

  // ── Generate HTML ad ─────────────────────────────────────────────────────
  const html = generateHtmlAd(product, copy, audioUrl);
  const htmlFilename = `${product.slug}-${weekKey}.html`;
  const htmlPath = `dwa-ads/${htmlFilename}`;

  log("Uploading HTML to storage", { path: htmlPath });

  const htmlBlob = new Blob([html], { type: "text/html" });
  const { error: htmlUploadErr } = await sb.storage
    .from("ad-creatives")
    .upload(htmlPath, htmlBlob, { contentType: "text/html", upsert: true });

  if (htmlUploadErr) {
    return json({ error: `HTML upload failed: ${htmlUploadErr.message}` }, 500);
  }

  const htmlPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/ad-creatives/${htmlPath}`;
  log("HTML hosted", { url: htmlPublicUrl });

  // ── Render HTML → MP4 via dwa-ad-renderer ─────────────────────────────
  log("Calling dwa-ad-renderer");

  const renderRes = await fetch(
    `${SUPABASE_URL}/functions/v1/dwa-ad-renderer`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        htmlUrl: htmlPublicUrl,
        product: product.slug,
        durationMs: product.animDurationMs,
        audioUrl,  // informational — audio is already embedded in the HTML
      }),
      signal: AbortSignal.timeout(product.animDurationMs + 60_000),
    }
  );

  const renderData = await renderRes.json();
  if (!renderRes.ok || !renderData.mp4Url) {
    return json({ error: `Render failed: ${renderData.error ?? JSON.stringify(renderData)}` }, 500);
  }

  const mp4Url = renderData.mp4Url;
  log("MP4 ready", { mp4Url });

  // ── Post to Meta ─────────────────────────────────────────────────────────
  log("Calling meta-ads-poster");

  const metaRes = await fetch(
    `${SUPABASE_URL}/functions/v1/meta-ads-poster`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoUrl: mp4Url,
        brandSlug: product.brandSlug,
        dailyBudgetCents: 500,
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );

  const metaData = await metaRes.json();
  const adsManagerUrl = metaData?.adsManagerUrl ?? null;
  log("Meta campaign created", { adsManagerUrl });

  // ── SMS Matt ──────────────────────────────────────────────────────────────
  const adminPhone = Deno.env.get("ADMIN_PHONE");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (adminPhone && twilioSid && twilioToken && twilioFrom) {
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${twilioSid}:${twilioToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: twilioFrom,
          To: adminPhone,
          Body: `🎬 DWA Ad Factory — ${product.name}\nWeek: ${weekKey}\n${audioUrl ? "🎙 Voiceover: " + audioUrl.split('/').pop() + "\n" : ""}Campaign PAUSED — review + activate:\n${adsManagerUrl ?? "check Ads Manager"}`,
        }),
      });
    } catch (e) {
      log("SMS failed (non-fatal)", { error: String(e) });
    }
  }

  return json({
    success: true,
    weekKey,
    product: product.name,
    brandSlug: product.brandSlug,
    voiceoverScript: narrationScript,
    audioUrl,
    htmlUrl: htmlPublicUrl,
    mp4Url,
    adsManagerUrl,
    status: "PAUSED — review in Ads Manager then activate",
    metaResult: metaData,
  });
});
