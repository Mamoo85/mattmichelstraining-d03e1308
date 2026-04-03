// STR Reputation Monitor — cron every 6 hours (0 */6 * * *)
// Scrapes short-term rental property listings for new reviews, drafts AI responses, alerts hosts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

async function sendSMS(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return;
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }),
    }
  );
}

async function scrapePropertyReviews(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const data = await res.json();
    return data?.data?.markdown || data?.markdown || "";
  } catch (e) {
    console.error("[str-reputation-monitor] Firecrawl scrape error:", e);
    return "";
  }
}

async function draftReviewResponse(
  reviewText: string,
  rating: number,
  propertyName: string,
  hostName: string
): Promise<string> {
  const prompt = `You are helping ${hostName}, a short-term rental host, respond to a guest review for their property "${propertyName}".

Guest Review (${rating}/5 stars):
"${reviewText}"

Write a warm, personalized host response (150-200 words) that:
- Opens by thanking the guest by name if inferable, otherwise "Thank you for staying with us"
- For 4-5 star reviews: Express genuine gratitude, highlight 1-2 specific things they mentioned, invite them back
- For 1-3 star reviews: Acknowledge their concern with empathy, briefly address the specific issue, apologize sincerely, explain any steps taken to improve, invite them to reach out directly
- Sounds like a real person, not a corporate template
- Ends with a warm closing like "We hope to host you again!" or "Safe travels!"
- Do NOT offer refunds or discounts in a public response
- Do NOT be defensive or make excuses

Write only the response text — no labels or formatting.`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const aiData = await aiRes.json();
  return aiData?.content?.[0]?.text?.trim() || "";
}

function extractReviewsFromMarkdown(markdown: string): Array<{ text: string; rating: number; reviewer: string; date: string; id: string }> {
  const reviews: Array<{ text: string; rating: number; reviewer: string; date: string; id: string }> = [];

  // Look for star patterns (Airbnb/VRBO style content)
  // This is a best-effort extraction from scraped markdown
  const reviewBlocks = markdown.split(/(?=\n#{1,3}\s|\n\*{3,}|\n---)/);

  for (const block of reviewBlocks) {
    // Try to detect rating (look for star counts or numeric ratings)
    const ratingMatch = block.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|stars?|★)/i) ||
                        block.match(/★{1,5}/) ||
                        block.match(/Rated\s+(\d(?:\.\d)?)/i);

    const starsMatch = block.match(/★+/);
    let rating = 5; // default optimistic
    if (ratingMatch?.[1]) {
      rating = parseFloat(ratingMatch[1]);
    } else if (starsMatch) {
      rating = starsMatch[0].length;
    }

    // Extract reviewer name (look for common patterns)
    const nameMatch = block.match(/(?:by|from|reviewer?:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i) ||
                      block.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?)?)\s*\n/m);
    const reviewer = nameMatch?.[1] || "Guest";

    // Extract date
    const dateMatch = block.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i) ||
                      block.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    const date = dateMatch?.[0] || new Date().toLocaleDateString();

    // Extract review text (substantial paragraph content)
    const textMatch = block.match(/[""]([^"""]{50,})["""]/s) ||
                      block.match(/(?:review|comment|said|wrote)[:：]\s*(.{50,})/is);
    const text = textMatch?.[1]?.trim() ||
                 block.replace(/^#+.*$/mg, "").replace(/\*+/g, "").trim().slice(0, 500);

    if (text && text.length > 40) {
      // Create a stable ID from content hash
      const id = `${reviewer}-${date}-${text.slice(0, 30)}`.replace(/\s+/g, "-").toLowerCase();
      reviews.push({ text, rating, reviewer, date, id });
    }
  }

  return reviews.slice(0, 10); // cap at 10 reviews per scrape
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients, error } = await sb
    .from("str_reputation_clients")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("[str-reputation-monitor] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!clients?.length) {
    console.log("[str-reputation-monitor] No active clients");
    return new Response(JSON.stringify({ checked: 0 }), { status: 200 });
  }

  let totalAlerts = 0;

  for (const client of clients) {
    try {
      const propertyUrls: string[] = client.property_urls || (client.property_url ? [client.property_url] : []);
      if (!propertyUrls.length) continue;

      const hostName = client.contact_name || client.host_name || "Host";
      const lastSeenId = client.last_seen_review || "";

      for (const url of propertyUrls) {
        try {
          // Derive property name from URL
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split("/").filter(Boolean);
          const propertyName = client.property_name ||
            pathParts[pathParts.length - 1]?.replace(/-/g, " ") ||
            urlObj.hostname;

          const markdown = await scrapePropertyReviews(url);
          if (!markdown) continue;

          const reviews = extractReviewsFromMarkdown(markdown);
          if (!reviews.length) continue;

          // Find new reviews (not seen before)
          const newReviews = lastSeenId
            ? reviews.filter((r) => r.id !== lastSeenId && !r.id.includes(lastSeenId.slice(0, 10)))
            : reviews.slice(0, 3); // on first run, take up to 3 most recent

          if (!newReviews.length) continue;

          for (const review of newReviews) {
            const draftResponse = await draftReviewResponse(
              review.text,
              review.rating,
              propertyName,
              hostName
            );

            const isLowRating = review.rating <= 3;
            const starEmoji = "⭐".repeat(Math.max(1, Math.min(5, review.rating)));

            // Email host with review + AI draft
            if (RESEND_API_KEY && client.email) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "M² STR Monitor <matt@mattmichelstraining.com>",
                  to: [client.email],
                  subject: `${isLowRating ? "⚠️ " : "⭐ "}New Review — ${propertyName} (${review.rating}/5)`,
                  html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² STR Reputation Monitor</p>
    <p style="margin:6px 0 0;color:#fff;font-size:18px;font-weight:700;">New Review — ${propertyName}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <div style="background:${isLowRating ? "#fef2f2" : "#f0fdf4"};border:1px solid ${isLowRating ? "#fecaca" : "#bbf7d0"};border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e293b;">${starEmoji} ${review.rating}/5 — ${review.reviewer}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${review.date}</p>
      <p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.7;font-style:italic;">"${review.text}"</p>
    </div>

    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">Your AI-Drafted Response</p>
    <div style="background:#f8fafc;border-left:4px solid #e8621a;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${draftResponse.replace(/\n/g, "<br>")}</p>
    </div>

    <a href="${url}" style="display:inline-block;background:#e8621a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;margin:0 0 20px;">Post Response →</a>

    ${isLowRating ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">Low rating detected — you've also been sent an SMS alert.</p>
    </div>` : ""}

    <hr style="border:1px solid #e2e8f0;margin:20px 0;">
    <p style="font-size:12px;color:#94a3b8;">The suggested response above is ready to copy and paste. Always personalize before posting.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² STR Monitor · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
                }),
              });
              totalAlerts++;
            }

            // SMS for low ratings
            if (isLowRating && client.phone) {
              await sendSMS(
                client.phone,
                `⚠️ M² STR Alert: New ${review.rating}/5 star review on ${propertyName}!\n\n"${review.text.slice(0, 120)}${review.text.length > 120 ? "…" : ""}"\n\nCheck your email for a drafted response. Act quickly — responses within 24h matter most.`
              );
            }
          }

          // Update last seen review
          if (reviews[0]) {
            await sb
              .from("str_reputation_clients")
              .update({
                last_seen_review: reviews[0].id,
                last_check_at: new Date().toISOString(),
                reviews_responded: (client.reviews_responded || 0) + newReviews.length,
              })
              .eq("id", client.id);
          }
        } catch (urlErr) {
          console.error(`[str-reputation-monitor] Error for URL ${url}:`, urlErr);
        }
      }
    } catch (e) {
      console.error(`[str-reputation-monitor] Error for client ${client.id}:`, e);
    }
  }

  console.log(`[str-reputation-monitor] Checked ${clients.length} clients, sent ${totalAlerts} alerts`);
  return new Response(JSON.stringify({ checked: clients.length, alerts: totalAlerts }), { status: 200 });
});
