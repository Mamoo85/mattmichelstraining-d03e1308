import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPostsPrompt(businessName: string, businessType: string, city: string, differentiators: string): string {
  return `You are a local SEO and Google Business Profile expert. Generate 30 ready-to-publish Google Business Profile posts for the following business.

Business Name: ${businessName}
Business Type: ${businessType}
City/Location: ${city}
What makes them stand out: ${differentiators}

RULES:
- Each post should be 75-120 words
- Write in a friendly, local, human tone — NOT corporate or robotic
- Mix these post types across the 30 posts: (1) service highlight, (2) customer tip, (3) seasonal/local relevance, (4) behind the scenes, (5) FAQ answer, (6) testimonial teaser, (7) special offer teaser, (8) community connection
- Reference ${city} naturally in at least 8 posts
- Never use hashtags
- Each post should end with a soft call to action (call us, stop by, visit our website, book online, etc.) — vary the CTA, don't use the same one every time
- Posts should sound like a real person who works there, not marketing copy

Format EXACTLY as:
---
POST 1 (Service Highlight)
[post text here]

---
POST 2 (Customer Tip)
[post text here]

[continue for all 30 posts]
---

Generate all 30 posts now.`;
}

async function generatePosts(businessName: string, businessType: string, city: string, differentiators: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: buildPostsPrompt(businessName, businessType, city, differentiators) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI Gateway error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function sendPostsEmail(email: string, businessName: string, postsText: string): Promise<void> {
  // Format posts as clean HTML blocks
  const postsHtml = postsText
    .split(/\n---\n/)
    .filter(p => p.trim())
    .map((post, i) => {
      const lines = post.trim().split("\n");
      const header = lines[0] || `Post ${i + 1}`;
      const body = lines.slice(1).join("\n").trim();
      return `
        <div style="margin-bottom:20px;padding:20px;background:#f8fafc;border-radius:6px;border-left:3px solid #e8621a">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#e8621a;font-family:sans-serif">${header}</p>
          <p style="margin:0;color:#1e293b;line-height:1.7;font-family:sans-serif;font-size:14px;white-space:pre-wrap">${body}</p>
        </div>`;
    }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#1e293b;padding:28px 32px">
      <p style="color:#e8621a;font-weight:700;font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Web Design</p>
      <h1 style="color:#fff;margin:0;font-family:Georgia,serif;font-size:22px">Your 30 GBP Posts Are Ready</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">For: ${businessName || email}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#475569;line-height:1.7;font-family:sans-serif;font-size:15px;margin:0 0 24px">
        Here are your <strong>30 Google Business Profile posts</strong> — enough to post 2-3x per week for the next 3 months. Each one is ready to copy and paste directly into your Google Business Profile.
      </p>
      <div style="background:#fff7ed;border-radius:6px;padding:16px 20px;border:1px solid #fed7aa;margin-bottom:28px">
        <p style="margin:0;font-size:13px;color:#92400e;font-family:sans-serif">
          <strong>How to post:</strong> Go to business.google.com → Your Business Profile → Add Update → paste the post → publish. Takes about 30 seconds each.
          <br><br>Want us to handle this automatically every week? Our <strong>GBP Autopilot service is $49/month</strong> — we post for you every Monday, Wednesday, and Friday.
          <a href="https://www.mattmichelstraining.com/local-marketing" style="color:#e8621a;font-weight:700">See details here.</a>
        </p>
      </div>
      ${postsHtml}
      <div style="margin-top:28px;padding:20px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-family:sans-serif">Questions?</p>
        <p style="margin:0;color:#475569;font-size:14px;font-family:sans-serif">
          Call or text Matt: <a href="tel:3138064952" style="color:#e8621a;font-weight:700">(313) 806-4952</a>
          &nbsp;·&nbsp; <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a">matt@mattmichelstraining.com</a>
        </p>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:12px;font-family:sans-serif">M² Web Design · mattmichelstraining.com · Grosse Pointe, MI</p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: [email],
      subject: `Your 30 Google Business Profile Posts — ${businessName || "M² Web Design"}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, business_name, business_type, city, differentiators, order_id } = await req.json();

    if (!email || !business_name) {
      return new Response(JSON.stringify({ error: "email and business_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Idempotency check
    if (order_id) {
      const { data: existing } = await sb.from("gbp_post_packs").select("status").eq("id", order_id).maybeSingle();
      if (existing?.status === "delivered") {
        console.log(`[gbp-post-pack] Already delivered for order ${order_id}`);
        return new Response(JSON.stringify({ ok: true, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await sb.from("gbp_post_packs").update({ status: "processing" }).eq("id", order_id);
    }

    const postsText = await generatePosts(
      business_name,
      business_type || "local business",
      city || "Michigan",
      differentiators || "quality service and customer satisfaction"
    );

    await sendPostsEmail(email, business_name, postsText);

    const updatePayload = { status: "delivered", posts_json: JSON.stringify({ raw: postsText }) };
    if (order_id) {
      await sb.from("gbp_post_packs").update(updatePayload).eq("id", order_id);
    } else {
      await sb.from("gbp_post_packs").insert({
        email,
        business_name: business_name || null,
        business_info: JSON.stringify({ business_type, city, differentiators }),
        status: "delivered",
        posts_json: JSON.stringify({ raw: postsText }),
      });
    }

    console.log(`[gbp-post-pack] Posts delivered to ${email} for ${business_name}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[gbp-post-pack]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
