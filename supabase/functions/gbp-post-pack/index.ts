import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPostsPrompt(businessName: string, businessType: string, city: string, differentiators: string): string {
  return `You are a local SEO and Google Business Profile expert. Generate 30 ready-to-publish Google Business Profile posts organized by a seasonal content calendar.

Business Name: ${businessName}
Business Type: ${businessType}
City/Location: ${city}
What makes them stand out: ${differentiators}

RULES:
- Each post should be 75-120 words
- Friendly, local, human tone — NOT corporate
- Mix these post types: (1) service highlight, (2) customer tip, (3) seasonal/local relevance, (4) behind the scenes, (5) FAQ answer, (6) testimonial teaser, (7) special offer teaser, (8) community connection
- Reference ${city} naturally in at least 8 posts
- Never use hashtags
- Each post ends with a varied soft call to action
- Posts should sound like a real person

Format EXACTLY as follows. Group posts by recommended month:

---
## MONTH 1 (Weeks 1-4)

### POST 1 (Service Highlight)
**Best Time to Post:** Tuesday or Thursday, 10am-12pm local time
**Image Idea:** [Describe a specific photo or AI image prompt they could use — e.g. "Close-up of freshly installed copper pipe fitting with clean workspace in background"]
[post text here]

### POST 2 (Customer Tip)
**Best Time to Post:** [day and time recommendation]
**Image Idea:** [specific image suggestion]
[post text here]

[Continue with ~10 posts for Month 1]

---
## MONTH 2 (Weeks 5-8)

[10 more posts, seasonal to the next month]

---
## MONTH 3 (Weeks 9-12)

[10 more posts, seasonal to the following month]

---

After all 30 posts, add:

## 📋 How to Post on Google Business Profile (Step-by-Step)
1. Go to business.google.com and sign in
2. Select your business
3. Click "Add Update" (or "Posts" in the menu)
4. Choose "Add Update" post type
5. Paste the post text
6. Add a photo (use the image suggestions above or your own photos)
7. Click "Publish" — done! Takes about 30 seconds.

**Pro Tips:**
- Post 2-3 times per week for maximum ranking benefit
- Use real photos from your business when possible — Google rewards authenticity
- Reply to any comments on your posts within 24 hours
- Keep posts under 1,500 characters (ours are already optimized)

Generate all 30 posts now.`;
}

async function generatePosts(businessName: string, businessType: string, city: string, differentiators: string): Promise<string> {
  const text = await generateText(buildPostsPrompt(businessName, businessType, city, differentiators), 3000);
  return text || "";
}

async function sendPostsEmail(email: string, businessName: string, postsText: string): Promise<void> {
  // Parse posts into HTML
  const htmlBody = postsText
    .replace(/^## (.+)$/gm, "<h2 style='color:#e8621a;font-family:Georgia,serif;margin-top:36px;margin-bottom:12px;font-size:20px;border-bottom:2px solid #e8621a;padding-bottom:8px'>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3 style='color:#1e293b;font-family:sans-serif;margin-top:20px;margin-bottom:6px;font-size:15px;font-weight:700'>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#1e293b'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^---$/gm, "<hr style='border:none;border-top:2px solid #e2e8f0;margin:32px 0'>")
    .replace(/^- (.+)$/gm, "<div style='padding:2px 0 2px 16px;font-size:14px;color:#475569'>• $1</div>")
    .replace(/^\d+\. (.+)$/gm, "<div style='padding:3px 0 3px 16px;font-size:14px;color:#475569'>$&</div>")
    .replace(/\n\n/g, "</p><p style='margin:0 0 12px;color:#475569;line-height:1.7;font-family:sans-serif;font-size:14px'>")
    .replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#1e293b;padding:28px 32px">
      <p style="color:#e8621a;font-weight:700;font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Development</p>
      <h1 style="color:#fff;margin:0;font-family:Georgia,serif;font-size:22px">Your 30 GBP Posts Are Ready</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">For: ${businessName || email}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#475569;line-height:1.7;font-family:sans-serif;font-size:15px;margin:0 0 8px">
        Here are your <strong>30 Google Business Profile posts</strong> organized into a <strong>3-month content calendar</strong>. Each post includes:
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:2">
        <li>📅 Best time to post</li>
        <li>📸 Image/photo suggestion</li>
        <li>✍️ Ready-to-paste post text</li>
        <li>📋 Step-by-step posting guide at the bottom</li>
      </ul>

      <div style="background:#f8fafc;border-radius:6px;padding:24px;border:1px solid #e2e8f0">
        <p style="margin:0 0 12px;color:#475569;line-height:1.7;font-family:sans-serif;font-size:14px">${htmlBody}</p>
      </div>

      <!-- UPSELL: GBP Autopilot -->
      <div style="margin-top:28px;padding:20px;background:#ecfdf5;border-radius:8px;border:1px solid #6ee7b7">
        <p style="margin:0 0 6px;font-weight:700;color:#065f46;font-size:15px;font-family:sans-serif">🤖 Want Us to Post These Automatically? GBP Autopilot — $49/mo</p>
        <p style="margin:0 0 12px;color:#065f46;font-size:13px;font-family:sans-serif;line-height:1.6">
          We'll post to your Google Business Profile 3x/week on autopilot — Mon/Wed/Fri at the optimal time. You never touch it. Active profiles rank higher in Google's local map pack.
        </p>
        <a href="https://www.mattmichelstraining.com/local-marketing" style="display:inline-block;background:#e8621a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;font-family:sans-serif">See GBP Autopilot →</a>
      </div>

      <div style="margin-top:24px;padding:20px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-family:sans-serif">Questions?</p>
        <p style="margin:0;color:#475569;font-size:14px;font-family:sans-serif">
          Call or text Matt: <a href="tel:3138064952" style="color:#e8621a;font-weight:700">(313) 806-4952</a>
          &nbsp;·&nbsp; <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a">matt@mattmichelstraining.com</a>
        </p>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:12px;font-family:sans-serif">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
    </div>
  </div>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: [email],
      bcc: ["matthewmichels4@gmail.com"],
      subject: `Your 30 Google Business Profile Posts — ${businessName || "M² Development"}`,
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
        email, business_name: business_name || null,
        business_info: JSON.stringify({ business_type, city, differentiators }),
        status: "delivered", posts_json: JSON.stringify({ raw: postsText }),
      });
    }

    console.log(`[gbp-post-pack] Posts delivered to ${email} for ${business_name}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[gbp-post-pack]", err);
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const body = await req.clone().json().catch(() => ({}));
      await sb.from("delivery_failures").insert({
        function_name: "gbp-post-pack",
        error_message: err.message,
        customer_email: body.email || null,
        order_id: body.order_id || null,
      });
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Alerts <matt@mattmichelstraining.com>",
            to: ["matt@mattmichelstraining.com"],
            subject: `🚨 DELIVERY FAILED — gbp-post-pack — ${body.email || "unknown"}`,
            html: `<p><strong>Function:</strong> gbp-post-pack</p><p><strong>Customer:</strong> ${body.email || "unknown"}</p><p><strong>Error:</strong> ${err.message}</p>`,
          }),
        });
      }
    } catch (alertErr) { console.error("[gbp-post-pack] Alert failed:", alertErr); }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
