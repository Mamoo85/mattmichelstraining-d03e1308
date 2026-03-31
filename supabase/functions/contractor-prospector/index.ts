import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (step: string, data?: any) =>
  console.log(`[CONTRACTOR-PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

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

function pickOffer(trade: string, score: number, issues: string[]): { offer: string; pitch: string; price: string } {
  const isTrade = trade !== "dentist";
  const hasLowReviews = issues.some(i => i.includes("review"));
  const hasLowRating = issues.some(i => i.includes("star"));

  if (hasLowReviews || issues.some(i => i.includes("no website"))) {
    return {
      offer: "gbp",
      pitch: "Google Business Profile Management",
      price: "$199/mo",
    };
  }
  if (isTrade && hasLowRating) {
    return {
      offer: "missed_call",
      pitch: "Missed-Call Text Back",
      price: "$99/mo",
    };
  }
  return {
    offer: "leads",
    pitch: "Exclusive Local Leads",
    price: "$399/mo",
  };
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

async function generateEmail(
  businessName: string,
  trade: string,
  city: string,
  issues: string[],
  offer: { offer: string; pitch: string; price: string },
  anthropicKey: string,
): Promise<{ subject: string; body: string }> {
  const issueText = issues.length > 0 ? issues.join(", ") : "limited online presence";
  const cityShort = city.replace(" MI", "");

  let offerDesc = "";
  if (offer.offer === "gbp") {
    offerDesc = `I run an automated Google Business Profile management service for ${trade}s in Metro Detroit — ${offer.price}. It handles posting, Q&As, and ranking optimization automatically. Most contractors I work with jump into the top 3 in their zip within 60 days.`;
  } else if (offer.offer === "missed_call") {
    offerDesc = `I built a missed-call text back system for ${trade}s — ${offer.price}. When you're under a sink or on a roof and miss a call, it automatically texts that person back within 30 seconds. The contractor who responds first usually gets the job.`;
  } else {
    offerDesc = `I run an exclusive local lead system for ${trade}s in Metro Detroit — ${offer.price}. One contractor per trade per city. Real homeowner leads, no shared with competitors. I've got one spot open for ${cityShort}.`;
  }

  const prompt = `Write a short, direct cold email from Matt Michels (local business owner, Grosse Pointe MI) to the owner of "${businessName}" (a ${trade} in ${cityShort}, MI).

Observed issue: ${issueText}
Offer: ${offerDesc}

Rules:
- 4-6 sentences max
- Blue-collar tone, not corporate
- Start with "Hey —" not "Dear" or "Hi [Name]"
- Mention the specific issue you noticed (${issueText})
- One clear CTA: reply to this email or text (313) 806-4952
- Sign off as "— Matt, Grosse Pointe"
- No subject line in the body

Also output a subject line (under 50 chars, no ALL CAPS, feels personal not promotional).

Format your response as:
SUBJECT: [subject line]
BODY:
[email body]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

  return {
    subject: subjectMatch?.[1]?.trim() || `Quick thing I noticed about ${businessName}`,
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

serve(async () => {
  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const combos = getTodaysCombos();
    let totalEmailed = 0;
    let totalFound = 0;
    let totalSkipped = 0;

    for (const { trade, city } of combos) {
      log("Searching", { trade, city });
      const places = await searchGoogleMaps(`${trade} in ${city}`, GOOGLE_MAPS_API_KEY);
      totalFound += places.length;

      for (const place of places.slice(0, 8)) {
        const name = place.displayName?.text || "Unknown Business";
        const phone = place.nationalPhoneNumber || null;
        const website = place.websiteUri || null;

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

        // Get email from website
        let email: string | null = null;
        if (website) email = await scrapeEmail(website);

        if (!email) {
          // Still insert as a lead even without email (for SMS follow-up)
          const { score, issues } = scoreGbp(place);
          const offer = pickOffer(trade, score, issues);
          await sb.from("outreach_leads").insert({
            business_name: name,
            city: city.replace(" MI", ""),
            industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
            phone,
            website: website || null,
            status: "lead_found",
            channel: "sms",
            offer_pitched: offer.offer,
            notes: `GBP issues: ${issues.join(", ")}. Score: ${score}`,
          });
          totalSkipped++;
          continue;
        }

        // Score and pick offer
        const { score, issues } = scoreGbp(place);
        const offer = pickOffer(trade, score, issues);

        // Generate email
        const { subject, body } = await generateEmail(name, trade, city.replace(" MI", ""), issues, offer, ANTHROPIC_API_KEY);
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

        // Store lead
        await sb.from("outreach_leads").insert({
          business_name: name,
          city: city.replace(" MI", ""),
          industry: trade.charAt(0).toUpperCase() + trade.slice(1).replace(" contractor", ""),
          phone,
          email,
          website: website || null,
          status: "emailed",
          channel: "email",
          offer_pitched: offer.offer,
          last_contact_date: new Date().toISOString().split("T")[0],
          notes: `GBP issues: ${issues.join(", ")}. Score: ${score}. Offer: ${offer.pitch}`,
        });

        // Log send
        await sb.from("email_send_log" as any).insert({
          recipient_email: email,
          template_name: "contractor_drip_d0",
          status: "sent",
          message_id: `contractor_d0_${Date.now()}_${email}`,
        });

        totalEmailed++;
        log("Emailed", { name, email, offer: offer.offer, city });

        // Throttle
        await new Promise(r => setTimeout(r, 300));

        if (totalEmailed >= 15) break;
      }
      if (totalEmailed >= 15) break;
    }

    return new Response(
      JSON.stringify({ ok: true, found: totalFound, emailed: totalEmailed, skipped: totalSkipped, combos }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
