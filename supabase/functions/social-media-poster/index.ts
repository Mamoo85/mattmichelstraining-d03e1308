// Social Media Poster — called Mon/Wed/Fri by cron
// Generates AI content for each active social media client and posts to Facebook + LinkedIn

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function generatePost(
  businessName: string,
  businessType: string,
  city: string,
  platform: "facebook" | "linkedin"
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return `${businessName} is here to help with all your ${businessType} needs in ${city}. Reach out today!`;
  }

  const postTypes = [
    `Write a ${platform === "linkedin" ? "LinkedIn" : "Facebook"} post for ${businessName}, a ${businessType} in ${city}. Focus on a seasonal tip or service reminder. 1-3 sentences. No excessive hashtags. Sound like a real local business owner, not a marketer.`,
    `Write a short ${platform === "linkedin" ? "professional LinkedIn" : "friendly Facebook"} update for ${businessName} (${businessType}, ${city}) highlighting their reliability and local experience. 1-3 sentences. Conversational and genuine.`,
    `Write a "did you know" style ${platform === "linkedin" ? "LinkedIn" : "Facebook"} post for ${businessName}, a ${businessType} serving ${city}. Share a useful fact or tip relevant to their industry. 2-3 sentences.`,
    `Write a customer-focused ${platform === "linkedin" ? "LinkedIn" : "Facebook"} post for ${businessName} in ${city} (${businessType}). Mention that they're accepting new clients. 1-2 sentences. Direct and local.`,
  ];

  const prompt = postTypes[Math.floor(Date.now() / 86400000) % postTypes.length];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: prompt }] }) });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    `${businessName} — serving ${city} with quality ${businessType} services. Contact us today!`
  );
}

async function postToFacebook(
  pageId: string,
  accessToken: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: accessToken }) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function postToLinkedIn(
  orgId: string,
  accessToken: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: `urn:li:organization:${orgId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: message },
            shareMediaCategory: "NONE" } },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } }) });
    return res.ok;
  } catch {
    return false;
  }
}

async function notifyMatt(businessName: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@notify.m2training.com>",
      to: ["matt@m2training.com"],
      subject: `New client ${businessName} needs their social accounts connected`,
      html: `<p>New client <strong>${businessName}</strong> needs their social accounts connected before we can start posting.</p><p>Please reach out to them to collect their Facebook Page ID, LinkedIn Org ID, and access tokens.</p>` }) });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("social_media_clients")
      .select(
        "id, business_name, business_type, city, state, email, platforms, fb_page_id, linkedin_org_id, access_tokens, post_count"
      )
      .eq("active", true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ posted: 0, skipped: 0, errors: 0 }), { status: 200 });
    }

    let posted = 0;
    let skipped = 0;
    let errors = 0;

    for (const client of clients) {
      const location = `${client.city || ""}${client.state ? ", " + client.state : ""}`;
      const businessType = client.business_type || "local business";
      const tokens: Record<string, string> = client.access_tokens || {};

      const hasFbConnection = client.fb_page_id && tokens.facebook;
      const hasLinkedInConnection = client.linkedin_org_id && tokens.linkedin;
      const hasAnyConnection = hasFbConnection || hasLinkedInConnection;

      if (!hasAnyConnection) {
        skipped++;
        await notifyMatt(client.business_name);
        continue;
      }

      let clientPosted = false;
      let clientErrored = false;

      // Post to Facebook
      if (hasFbConnection) {
        try {
          const message = await generatePost(client.business_name, businessType, location, "facebook");
          const ok = await postToFacebook(client.fb_page_id, tokens.facebook, message);
          if (ok) {
            clientPosted = true;
          } else {
            clientErrored = true;
            console.error(`[SOCIAL-POSTER] Facebook post failed for ${client.business_name}`);
          }
        } catch (e) {
          clientErrored = true;
          console.error(`[SOCIAL-POSTER] Facebook error for ${client.business_name}:`, e);
        }
      }

      // Post to LinkedIn
      if (hasLinkedInConnection) {
        try {
          const message = await generatePost(client.business_name, businessType, location, "linkedin");
          const ok = await postToLinkedIn(client.linkedin_org_id, tokens.linkedin, message);
          if (ok) {
            clientPosted = true;
          } else {
            clientErrored = true;
            console.error(`[SOCIAL-POSTER] LinkedIn post failed for ${client.business_name}`);
          }
        } catch (e) {
          clientErrored = true;
          console.error(`[SOCIAL-POSTER] LinkedIn error for ${client.business_name}:`, e);
        }
      }

      if (clientPosted) {
        await sb
          .from("social_media_clients")
          .update({
            last_post_at: new Date().toISOString(),
            post_count: (client.post_count || 0) + 1 })
          .eq("id", client.id);
        posted++;
      }

      if (clientErrored && !clientPosted) {
        errors++;
      }
    }

    console.log(`[SOCIAL-POSTER] Posted: ${posted}, Skipped (no tokens): ${skipped}, Errors: ${errors}`);
    return new Response(JSON.stringify({ posted, skipped, errors }), { status: 200 });
  } catch (e: any) {
    console.error("[SOCIAL-POSTER] Fatal error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
