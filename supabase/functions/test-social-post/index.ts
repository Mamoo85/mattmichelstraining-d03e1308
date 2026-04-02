// Test social media posting — generates a preview or posts after approval
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "check"; // "check" | "preview" | "post_facebook" | "post_linkedin"
  const message = body.message || "";

  const results: Record<string, unknown> = {};

  // Step 1: Check which secrets are actually available
  if (action === "check") {
    results.secrets = {
      LOVABLE_API_KEY: LOVABLE_API_KEY ? `SET (${LOVABLE_API_KEY.length} chars)` : "MISSING",
      META_ACCESS_TOKEN: META_ACCESS_TOKEN ? `SET (${META_ACCESS_TOKEN.length} chars)` : "MISSING",
      META_PAGE_ID: META_PAGE_ID || "MISSING",
      LINKEDIN_ACCESS_TOKEN: LINKEDIN_ACCESS_TOKEN ? `SET (${LINKEDIN_ACCESS_TOKEN.length} chars)` : "MISSING",
    };
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2: Generate a preview post
  if (action === "preview") {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: "Write a 2-3 sentence LinkedIn post from Matt Michels, a Metro Detroit local marketing consultant, about why local contractors lose jobs by missing calls — and how automated text-back solves it. Conversational, no corporate speak."
        }],
      }),
    });
    const data = await res.json();
    const preview = data?.choices?.[0]?.message?.content?.trim() || "Could not generate";
    return new Response(JSON.stringify({ preview }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 3: Actually post to Facebook
  if (action === "post_facebook") {
    if (!META_ACCESS_TOKEN || !META_PAGE_ID) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN or META_PAGE_ID missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(`https://graph.facebook.com/v19.0/${META_PAGE_ID}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: META_ACCESS_TOKEN }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 4: Actually post to LinkedIn
  if (action === "post_linkedin") {
    if (!LINKEDIN_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "LINKEDIN_ACCESS_TOKEN missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // First get person URN
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) {
      return new Response(JSON.stringify({ error: "LinkedIn profile fetch failed", status: profileRes.status, data: profileData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authorUrn = `urn:li:person:${profileData.sub}`;

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
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
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const postData = await postRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: postRes.ok, status: postRes.status, data: postData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
