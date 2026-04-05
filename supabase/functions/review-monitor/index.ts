// Review Monitor — cron every 6 hours
// Polls Google Places API for new reviews on each client's listing
// Texts owner via Twilio when a new review arrives + AI-suggested response

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function getPlaceReviews(placeId: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.result?.reviews || [];
}

async function generateSuggestedResponse(reviewText: string, rating: number, businessName: string): Promise<string> {
  const prompt = `Write a professional, warm response to this Google review for ${businessName}.

Review (${rating}/5 stars): "${reviewText}"

Rules:
- 2-3 sentences max
- Thank them by name if possible (use "Thank you" generically if no name)
- For 4-5 star: genuine gratitude + invite them back
- For 1-3 star: acknowledge concern, apologize briefly, offer to make it right offline, include contact info
- Sound human, not corporate
- Do NOT offer discounts or freebies in the response

Just write the response text, no formatting.`;

  return await generateText(prompt, 1024);
}

async function sendSMS(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }),
  });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients } = await sb.from("review_monitor_clients").select("*").eq("active", true).not("google_place_id", "is", null);
  if (!clients?.length) return new Response(JSON.stringify({ checked: 0 }), { status: 200 });

  let alerts = 0;

  for (const client of clients) {
    try {
      const reviews = await getPlaceReviews(client.google_place_id);
      if (!reviews.length) continue;

      // Sort by time descending, find reviews newer than last seen
      const sorted = reviews.sort((a: any, b: any) => b.time - a.time);
      const newest = sorted[0];
      const newestId = String(newest.time);

      if (client.last_seen_review_id === newestId) continue; // no new reviews

      // Find all new reviews since last check
      const lastTime = client.last_seen_review_id ? parseInt(client.last_seen_review_id) : 0;
      const newReviews = sorted.filter((r: any) => r.time > lastTime);

      for (const review of newReviews) {
        const stars = "⭐".repeat(review.rating);
        const reviewText = review.text?.slice(0, 200) || "(no text)";
        const authorName = review.author_name || "Someone";

        const suggestedResponse = await generateSuggestedResponse(review.text || "", review.rating, client.business_name);

        // SMS alert to owner
        if (client.phone) {
          const smsBody = `⭐ New Google Review for ${client.business_name}\n\n${stars} — ${authorName}\n"${reviewText}${review.text?.length > 200 ? "…" : ""}"\n\nSuggested response:\n"${suggestedResponse}"\n\n– M² Review Monitor`;
          await sendSMS(client.phone, smsBody);
          alerts++;
        }

        // Also email the suggested response for easy copy-paste
        if (RESEND_API_KEY && client.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Review Monitor <matt@mattmichelstraining.com>",
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `${review.rating >= 4 ? "⭐" : "⚠️"} New Google Review — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:500px;padding:24px">
<h2 style="color:#e8621a;margin:0 0 8px">New ${review.rating}/5 Star Review</h2>
<p style="color:#64748b;font-size:13px;margin:0 0 16px">${authorName} · ${new Date(review.time * 1000).toLocaleDateString()}</p>
<p style="background:#f8fafc;border-left:3px solid #e8621a;padding:12px 16px;font-style:italic;margin:0 0 24px">"${review.text || "(no text)"}"</p>
<h3 style="margin:0 0 8px;color:#1e293b">Suggested Response (copy & paste into Google):</h3>
<p style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:6px;margin:0 0 16px">${suggestedResponse}</p>
<a href="https://business.google.com" style="background:#e8621a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">Post Response on Google →</a>
</div>`,
            }),
          });
        }
      }

      // Update last seen review ID
      await sb.from("review_monitor_clients").update({ last_seen_review_id: newestId }).eq("id", client.id);
    } catch (e) {
      console.error(`[review-monitor] Error for ${client.email}:`, e);
    }
  }

  console.log(`[review-monitor] Checked ${clients.length} clients, sent ${alerts} alerts`);
  return new Response(JSON.stringify({ checked: clients.length, alerts }), { status: 200 });
});
