// Social Media Poster — called Mon/Wed/Fri by cron
// Generates AI content for each active social media client and posts to Facebook, LinkedIn, GBP, and TikTok

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// Global fallback tokens (Matt's accounts)
const GLOBAL_META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const GLOBAL_META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";
const GLOBAL_LINKEDIN_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";

type Platform = "facebook" | "linkedin" | "gbp" | "tiktok";

let _linkedinPersonUrn: string | null = null;
async function getLinkedInPersonUrn(token: string): Promise<string | null> {
  if (_linkedinPersonUrn) return _linkedinPersonUrn;
  try {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    _linkedinPersonUrn = `urn:li:person:${data.sub}`;
    return _linkedinPersonUrn;
  } catch {
    return null;
  }
}

async function generatePost(
  businessName: string,
  businessType: string,
  city: string,
  platform: Platform
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return `${businessName} is here to help with all your ${businessType} needs in ${city}. Reach out today!`;
  }

  const platformLabels: Record<Platform, string> = {
    facebook: "Facebook",
    linkedin: "LinkedIn",
    gbp: "Google Business Profile",
    tiktok: "TikTok",
  };

  const platformInstructions: Record<Platform, string> = {
    facebook: "Friendly, local, conversational. 1-3 sentences.",
    linkedin: "Professional, B2B-appropriate. 1-3 sentences.",
    gbp: "Local SEO focused, mention the city and service. Include a call to action like 'Call us today' or 'Visit us at'. 1-3 sentences. Do NOT use hashtags.",
    tiktok: "Casual, trendy, hook-first. Use 2-3 relevant hashtags at the end. Keep it short and punchy — 1-2 sentences max.",
  };

  const postTypes = [
    `seasonal tip or service reminder`,
    `reliability and local experience highlight`,
    `"did you know" style tip relevant to their industry`,
    `customer-focused update — mention they're accepting new clients`,
  ];

  const topic = postTypes[Math.floor(Date.now() / 86400000) % postTypes.length];
  const label = platformLabels[platform];
  const instructions = platformInstructions[platform];

  const prompt = `Write a ${label} post for ${businessName}, a ${businessType} in ${city}. Focus on: ${topic}. ${instructions} Sound like a real local business owner, not a marketer.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    `${businessName} — serving ${city} with quality ${businessType} services. Contact us today!`
  );
}

async function postToFacebook(pageId: string, accessToken: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: accessToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postToLinkedIn(authorUrn: string, accessToken: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: message },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postToGBP(accountId: string, locationId: string, accessToken: string, message: string): Promise<boolean> {
  try {
    // Google Business Profile API - create local post
    const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        languageCode: "en",
        summary: message,
        topicType: "STANDARD",
        callToAction: {
          actionType: "LEARN_MORE",
          url: "https://www.mattmichelstraining.com/get-started",
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SOCIAL-POSTER] GBP post failed: ${errText}`);
    }
    return res.ok;
  } catch (e) {
    console.error("[SOCIAL-POSTER] GBP error:", e);
    return false;
  }
}

async function postToTikTok(openId: string, accessToken: string, message: string): Promise<boolean> {
  try {
    // TikTok Content Posting API — create a text post (video-less post / photo post caption)
    // Note: TikTok's API primarily supports video uploads. For text-only posts,
    // we use the "direct post" approach. If the client doesn't have video,
    // we'll create a photo post with the caption text.
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: message,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          // TikTok requires media — for now log that we need video/image
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SOCIAL-POSTER] TikTok post failed: ${errText}`);
      // TikTok requires video/photo — log the caption for manual posting
      console.log(`[SOCIAL-POSTER] TikTok caption ready for ${openId}: ${message}`);
    }
    return res.ok;
  } catch (e) {
    console.error("[SOCIAL-POSTER] TikTok error:", e);
    return false;
  }
}

async function notifyMatt(businessName: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      bcc: ["matthewmichels4@gmail.com"],
      subject: `New client ${businessName} needs their social accounts connected`,
      html: `<p>New client <strong>${businessName}</strong> needs their social accounts connected before we can start posting.</p><p>Please reach out to them to collect their Facebook Page ID, LinkedIn Org ID, GBP Location ID, and/or TikTok access tokens.</p>`,
    }),
  });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("social_media_clients")
      .select(
        "id, business_name, business_type, city, state, email, platforms, fb_page_id, linkedin_org_id, gbp_account_id, gbp_location_id, tiktok_open_id, tiktok_access_token, access_tokens, post_count"
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

      const fbPageId = client.fb_page_id || GLOBAL_META_PAGE_ID;
      const fbToken = tokens.facebook || GLOBAL_META_TOKEN;
      const liToken = tokens.linkedin || GLOBAL_LINKEDIN_TOKEN;
      const liOrgId = client.linkedin_org_id || null;
      const gbpAccountId = client.gbp_account_id || null;
      const gbpLocationId = client.gbp_location_id || null;
      const gbpToken = tokens.gbp || tokens.google || null;
      const tiktokOpenId = client.tiktok_open_id || null;
      const tiktokToken = client.tiktok_access_token || tokens.tiktok || null;

      const hasFb = fbPageId && fbToken;
      const hasLinkedIn = liToken;
      const hasGBP = gbpAccountId && gbpLocationId && gbpToken;
      const hasTikTok = tiktokOpenId && tiktokToken;
      const hasAny = hasFb || hasLinkedIn || hasGBP || hasTikTok;

      if (!hasAny) {
        skipped++;
        await notifyMatt(client.business_name);
        continue;
      }

      let clientPosted = false;
      let clientErrored = false;

      // Post to Facebook
      if (hasFb) {
        try {
          const message = await generatePost(client.business_name, businessType, location, "facebook");
          const ok = await postToFacebook(fbPageId, fbToken, message);
          if (ok) clientPosted = true;
          else { clientErrored = true; console.error(`[SOCIAL-POSTER] FB failed: ${client.business_name}`); }
        } catch (e) { clientErrored = true; console.error(`[SOCIAL-POSTER] FB error:`, e); }
      }

      // Post to LinkedIn
      if (hasLinkedIn) {
        try {
          let authorUrn: string | null = liOrgId ? `urn:li:organization:${liOrgId}` : await getLinkedInPersonUrn(liToken);
          if (authorUrn) {
            const message = await generatePost(client.business_name, businessType, location, "linkedin");
            const ok = await postToLinkedIn(authorUrn, liToken, message);
            if (ok) clientPosted = true;
            else { clientErrored = true; console.error(`[SOCIAL-POSTER] LI failed: ${client.business_name}`); }
          }
        } catch (e) { clientErrored = true; console.error(`[SOCIAL-POSTER] LI error:`, e); }
      }

      // Post to Google Business Profile
      if (hasGBP) {
        try {
          const message = await generatePost(client.business_name, businessType, location, "gbp");
          const ok = await postToGBP(gbpAccountId!, gbpLocationId!, gbpToken!, message);
          if (ok) clientPosted = true;
          else { clientErrored = true; console.error(`[SOCIAL-POSTER] GBP failed: ${client.business_name}`); }
        } catch (e) { clientErrored = true; console.error(`[SOCIAL-POSTER] GBP error:`, e); }
      }

      // Post to TikTok
      if (hasTikTok) {
        try {
          const message = await generatePost(client.business_name, businessType, location, "tiktok");
          const ok = await postToTikTok(tiktokOpenId!, tiktokToken!, message);
          if (ok) clientPosted = true;
          else { clientErrored = true; console.error(`[SOCIAL-POSTER] TikTok failed: ${client.business_name}`); }
        } catch (e) { clientErrored = true; console.error(`[SOCIAL-POSTER] TikTok error:`, e); }
      }

      if (clientPosted) {
        await sb
          .from("social_media_clients")
          .update({
            last_post_at: new Date().toISOString(),
            post_count: (client.post_count || 0) + 1,
          })
          .eq("id", client.id);
        posted++;
      }

      if (clientErrored && !clientPosted) errors++;
    }

    console.log(`[SOCIAL-POSTER] Posted: ${posted}, Skipped: ${skipped}, Errors: ${errors}`);
    return new Response(JSON.stringify({ posted, skipped, errors }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SOCIAL-POSTER] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
