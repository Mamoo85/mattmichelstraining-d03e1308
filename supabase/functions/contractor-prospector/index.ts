import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (step: string, data?: any) =>
  console.log(`[CONTRACTOR-PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Daily send cap to protect domain reputation ──
const DAILY_SEND_CAP = 30;

// ── Metro Detroit targets only ──
const TRADES = ["roofer", "HVAC contractor", "plumber", "electrician", "dentist"];
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
    const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => {
        const l = e.toLowerCase();
        return !["example.com","google.com","facebook.com","wix.com","squarespace.com","sentry.io","w3.org"].some(d => l.includes(d))
          && !/\.(png|jpg|svg|js|css)$/i.test(l)
          && l.length < 60 && l.length > 5
          && /\.(com|net|org|biz|us)$/.test(l);
      });
    return emails[0] || null;
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
  anthropicKey: string,
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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = (data.content?.[0]?.text || "").trim();
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
  anthropicKey: string,
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
5. Sentence 4: Soft CTA — reply or text (313) 806-4952
6. Start with "Hey —" (never "Dear" or "Hi [Name]")
7. Sign off "— Matt, Grosse Pointe"
8. Blue-collar tone. Like a text from a buddy who happens to know marketing.
9. NO buzzwords (leverage, synergy, optimize, revolutionize, etc.)
10. Subject line: Under 40 chars, feels like a text message, lowercase ok

Format:
SUBJECT: [subject line]
BODY:
[4-sentence email]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Sniper Claude API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
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
<span style="margin-left:12px;font-size:13px;color:#334155;vertical-align:middle;"><strong>Matt Michels</strong> · Grosse Pointe, MI · (313) 806-4952</span>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
M² Performance Training · Grosse Pointe, MI
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

serve(async () => {
  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
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

    const combos = getTodaysCombos();
    let totalEmailed = 0;
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

        // ── SCOUT: AI lead qualification (score 1-10) ──
        const scout = await scoutScoreLead(
          name, trade, city.replace(" MI", ""),
          rating, reviewCount,
          !!website, !!phone, issues,
          ANTHROPIC_API_KEY,
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
            ANTHROPIC_API_KEY,
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
            from: "Matt Michels <matt@notify.m2training.com>",
            to: [email],
            bcc: ["matthewmichels@gmail.com", "matthewmichels4@gmail.com"],
            subject,
            html,
          }),
        });

        if (!emailRes.ok) {
          log("Email send failed", { name, email });
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
        skipped: totalSkipped,
        scoutRejected: totalScoutRejected,
        dailySentBefore: dailySent,
        dailySentAfter: dailySent + totalEmailed,
        cap: DAILY_SEND_CAP,
        combos,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
