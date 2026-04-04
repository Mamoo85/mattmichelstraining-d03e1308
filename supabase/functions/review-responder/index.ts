import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface Review {
  reviewId: string;
  reviewer: { displayName: string };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string };
}

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

async function getReviews(locationId: string, accessToken: string): Promise<Review[]> {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/-/locations/${locationId}/reviews?pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.reviews || [];
}

async function draftResponse(businessName: string, review: Review): Promise<string> {
  const stars = STAR_MAP[review.starRating] || 3;
  const reviewerName = review.reviewer.displayName || "there";
  const reviewText = review.comment || "";

  if (!LOVABLE_API_KEY) {
    if (stars >= 4) return `Thank you so much for your kind words, ${reviewerName}! We truly appreciate you taking the time to share your experience with ${businessName}. It means a lot to our team!`;
    return `Thank you for your feedback, ${reviewerName}. We're sorry your experience didn't meet expectations. We'd love the opportunity to make it right — please reach out to us directly so we can address your concerns.`;
  }

  const prompt = stars >= 4
    ? `Write a warm, genuine Google review response for ${businessName}. The customer (${reviewerName}) left a ${stars}-star review: "${reviewText}". Keep it under 400 characters. Sound like a real local business owner — grateful, personal, not robotic. Do not use exclamation points excessively.`
    : `Write a professional, de-escalating Google review response for ${businessName}. The customer (${reviewerName}) left a ${stars}-star review: "${reviewText}". Keep it under 400 characters. Acknowledge their concern, apologize sincerely, and invite them to contact you directly to resolve the issue. Sound human, not like a PR department.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: prompt }] }) });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  return text.slice(0, 400);
}

async function postReply(locationId: string, reviewId: string, accessToken: string, comment: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/-/locations/${locationId}/reviews/${reviewId}/reply`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json" },
        body: JSON.stringify({ comment }) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWeeklySummary(client: any, reviewCount: number, responseCount: number, newThisWeek: number): Promise<void> {
  if (!RESEND_API_KEY || !client.email) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Review Responder <matt@mattmichelstraining.com>",
      to: [client.email], bcc: ["matthewmichels4@gmail.com"],
      subject: `Your weekly review summary — ${client.business_name}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;">
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#e8621a;margin-bottom:8px;">M² Review Responder</p>
          <h1 style="font-size:22px;font-weight:900;margin:0 0 20px;">Weekly Review Summary<br/>${client.business_name}</h1>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:700;">New reviews this week</td>
              <td style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;font-size:20px;font-weight:900;color:#e8621a;text-align:right;">${newThisWeek}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border:1px solid #e2e8f0;font-size:13px;font-weight:700;">Total reviews responded to</td>
              <td style="padding:12px 16px;border:1px solid #e2e8f0;font-size:20px;font-weight:900;color:#e8621a;text-align:right;">${responseCount}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;font-weight:700;">Total reviews on profile</td>
              <td style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;font-size:20px;font-weight:900;color:#e8621a;text-align:right;">${reviewCount}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#64748b;line-height:1.6;">All new reviews this week received a response within 2 hours of posting. If you have any questions about a specific response, just reply to this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />
            <div>
              <p style="font-size:13px;font-weight:700;margin:0;">Matt Michels</p>
              <p style="font-size:12px;color:#64748b;margin:0;">M2 Development — (313) 806-4952</p>
            </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
          </div>
        </div>
      ` }) });
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("review_responder_clients")
      .select("id, business_name, email, gmb_location_id, gmb_access_token, last_checked_at, review_count, response_count")
      .eq("active", true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    let totalResponded = 0;

    for (const client of clients) {
      if (!client.gmb_location_id || !client.gmb_access_token) {
        console.log(`[REVIEW-RESPONDER] ${client.business_name}: no GMB credentials, skipping`);
        continue;
      }

      const lastChecked = client.last_checked_at ? new Date(client.last_checked_at) : new Date(0);
      const reviews = await getReviews(client.gmb_location_id, client.gmb_access_token);

      const newUnreplied = reviews.filter(r => {
        const created = new Date(r.createTime);
        return created > lastChecked && !r.reviewReply;
      });

      let responded = 0;
      for (const review of newUnreplied) {
        const response = await draftResponse(client.business_name, review);
        if (!response) continue;

        const posted = await postReply(client.gmb_location_id, review.reviewId, client.gmb_access_token, response);
        if (posted) {
          responded++;
          totalResponded++;
        }
      }

      const updatedResponseCount = (client.response_count || 0) + responded;
      const updatedReviewCount = Math.max(client.review_count || 0, reviews.length);

      await sb.from("review_responder_clients").update({
        last_checked_at: now.toISOString(),
        response_count: updatedResponseCount,
        review_count: updatedReviewCount }).eq("id", client.id);

      if (isMonday) {
        await sendWeeklySummary(client, updatedReviewCount, updatedResponseCount, newUnreplied.length);
      }

      console.log(`[REVIEW-RESPONDER] ${client.business_name}: ${newUnreplied.length} new, ${responded} responded`);
    }

    return new Response(JSON.stringify({ processed: clients.length, responded: totalResponded }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[REVIEW-RESPONDER] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
