// Test social media posting — generates a preview or posts after admin approval
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Admin auth check
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) throw new Error("Not authenticated");
    const { data: adminRole } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) throw new Error("Admin only");

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── CHECK: which secrets are configured ──
    if (action === "check") {
      return new Response(JSON.stringify({
        linkedin: !!LINKEDIN_ACCESS_TOKEN,
        facebook: !!(META_ACCESS_TOKEN && META_PAGE_ID),
        ai: !!LOVABLE_API_KEY,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GENERATE: AI-generate a preview post ──
    if (action === "generate") {
      const { contentType, platform, businessName, businessType, city, brandVoice, postTopic, contentFocus, targetAudience, customPrompt } = body;
      const plat = platform || "linkedin";
      const cType = contentType || "social_post";
      let prompt = "";
      if (customPrompt?.trim()) {
        prompt = customPrompt;
      } else {
        const voice = brandVoice ? ` Brand voice: ${brandVoice}.` : "";
        const focus = contentFocus ? ` Topic focus: ${contentFocus}.` : "";
        const topic = postTopic ? ` Post topic: ${postTopic}.` : "";
        const audience = targetAudience ? ` Target audience: ${targetAudience}.` : "";
        const biz = businessName || "M2 Development";
        const type = businessType || "local business";
        const loc = city || "Grosse Pointe";

        const typePrompts: Record<string, string> = {
          social_post: `Write a ${plat === "linkedin" ? "professional LinkedIn" : "engaging Facebook"} post for ${biz}, a ${type} in ${loc}.${voice}${focus}${topic}${audience} 2-4 sentences. Sound like a real local business owner. End with a clear CTA. 1-3 relevant hashtags max.`,
          gbp_post: `Write a Google Business Profile post for ${biz}, a ${type} in ${loc}.${voice}${focus}${topic}${audience} Under 300 words. Include a local keyword naturally. End with a strong CTA. No hashtags.`,
          newsletter_excerpt: `Write a short newsletter content block for ${biz} (${type}, ${loc}).${voice}${focus}${topic}${audience} 2-3 paragraphs. Informative and valuable. Include one actionable tip. Written as email newsletter content.`,
          blog_teaser: `Write a blog post teaser/excerpt for ${biz} (${type}, ${loc}).${voice}${focus}${topic}${audience} 3-4 paragraphs. SEO-friendly. Include a compelling headline at the start. Educational tone.`,
          ad_copy: `Write Google/Facebook ad copy for ${biz} (${type}, ${loc}).${voice}${focus}${topic}${audience} Format:\nHEADLINE (under 30 chars)\nDESCRIPTION (under 90 chars)\nLONG DESCRIPTION (2-3 sentences)\nCTA button text\n\nMake it compelling and action-oriented.`,
          email_outreach: `Write a cold B2B outreach email for ${biz} selling ${type} services in ${loc}.${voice}${focus}${topic}${audience} Subject line on the first line prefixed with "SUBJECT: ". Then the email body. Keep it under 150 words. Personable, not corporate. Clear value prop. One CTA.`,
        };

        prompt = typePrompts[cType] || typePrompts.social_post;
      }

      if (!LOVABLE_API_KEY) throw new Error("AI key not configured");

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }] }),
      });
      const aiData = await aiRes.json();
      const content = aiData?.choices?.[0]?.message?.content?.trim() || "Could not generate post.";

      return new Response(JSON.stringify({ content, platform: plat }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: actually publish to LinkedIn or Facebook ──
    if (action === "post") {
      const { platform, postContent } = body;
      if (!postContent) throw new Error("No post content");
      const plat = platform || "linkedin";

      if (plat === "linkedin") {
        if (!LINKEDIN_ACCESS_TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN not configured");
        const urnRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
        });
        if (!urnRes.ok) throw new Error(`LinkedIn auth failed (${urnRes.status})`);
        const urnData = await urnRes.json();
        const authorUrn = `urn:li:person:${urnData.sub}`;

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
            specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: postContent }, shareMediaCategory: "NONE" } },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
          }),
        });
        if (!postRes.ok) {
          const errText = await postRes.text();
          throw new Error(`LinkedIn post failed (${postRes.status}): ${errText}`);
        }
        return new Response(JSON.stringify({ success: true, platform: "linkedin" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (plat === "facebook") {
        if (!META_ACCESS_TOKEN || !META_PAGE_ID) throw new Error("Facebook tokens not configured");
        const postRes = await fetch(`https://graph.facebook.com/v19.0/${META_PAGE_ID}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: postContent, access_token: META_ACCESS_TOKEN }),
        });
        if (!postRes.ok) {
          const errText = await postRes.text();
          throw new Error(`Facebook post failed (${postRes.status}): ${errText}`);
        }
        return new Response(JSON.stringify({ success: true, platform: "facebook" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unknown platform: ${plat}`);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
