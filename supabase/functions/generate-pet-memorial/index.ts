import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomFour(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const {
      pet_name,
      pet_species,
      pet_breed,
      pet_age,
      personality_traits,
      favorite_memories,
      special_message,
      customer_email,
      customer_name,
      submission_id,
    } = await req.json();

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 1. Generate content via Claude ───────────────────────────────────────
    const prompt = `You are a compassionate writer creating a heartfelt pet memorial. The pet's family has shared the following details:

Pet Name: ${pet_name}
Species: ${pet_species || "unknown"}
Breed: ${pet_breed || "unknown"}
Age: ${pet_age || "unknown"}
Personality Traits: ${personality_traits || "Not provided"}
Favorite Memories: ${favorite_memories || "Not provided"}
Special Message from Family: ${special_message || "Not provided"}

Please create a memorial package as a JSON object with exactly these three fields:

{
  "poem": "A 10-14 line rhyming poem written from the pet's perspective, looking back on their life with love and gratitude. Should feel warm, not tragic. Use the pet's name and specific details from the family.",
  "tribute": "Three paragraphs. First paragraph: celebrate the pet's personality and spirit using the specific traits shared. Second paragraph: honor the favorite memories as vivid, specific moments. Third paragraph: a warm closing about the love that remains and the legacy the pet leaves behind.",
  "social_caption": "2-3 sentences suitable for Facebook or Instagram. Warm, genuine, not sentimental cliche. Uses the pet's name. Could include a small hashtag suggestion."
}

Respond with ONLY valid JSON. No markdown, no commentary, no extra text.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const rawContent = anthropicData?.content?.[0]?.text || "";

    let poem = "";
    let tribute = "";
    let social_caption = "";

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || rawContent);
      poem = parsed.poem || "";
      tribute = parsed.tribute || "";
      social_caption = parsed.social_caption || "";
    } catch {
      // Fallback: use raw content as tribute
      tribute = rawContent.slice(0, 800);
      poem = `In memory of ${pet_name}, beloved companion.`;
      social_caption = `Remembering ${pet_name}, forever in our hearts.`;
    }

    // ── 2. Generate slug and update DB ───────────────────────────────────────
    const slug = `in-memory-of-${slugify(pet_name)}-${randomFour()}`;

    if (submission_id) {
      await sb.from("pet_memorial_submissions").update({
        poem_generated: poem,
        tribute_generated: tribute,
        social_caption,
        memorial_url_slug: slug,
      }).eq("id", submission_id);
    }

    // ── 3. Send email via Resend ─────────────────────────────────────────────
    const siteOrigin = SUPABASE_URL.includes("localhost")
      ? "http://localhost:8080"
      : "https://www.mattmichelstraining.com";
    const memorialUrl = `${siteOrigin}/memorial/${slug}`;

    const tributeParagraphs = tribute
      .split(/\n\n+/)
      .filter(Boolean)
      .map((p: string) => `<p style="margin:0 0 16px;font-size:15px;color:#3d2a00;line-height:1.8;">${p}</p>`)
      .join("");

    const poemLines = poem
      .split(/\n/)
      .filter(Boolean)
      .map((l: string) => `${l}<br>`)
      .join("");

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Georgia,serif;">
<div style="max-width:580px;margin:0 auto;background:#FFF8F0;">

  <!-- Header -->
  <div style="background:#3d2a00;padding:28px 32px;text-align:center;">
    <p style="color:#d4a017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">M² Development · Pet Memorial</p>
    <h1 style="color:#FFF8F0;font-family:Georgia,serif;font-size:26px;margin:0;font-weight:400;">In Memory of ${pet_name}</h1>
    <p style="color:#c9a96e;font-size:13px;margin:8px 0 0;">A tribute created with love for ${customer_name || "your family"}</p>
  </div>

  <!-- Body -->
  <div style="padding:32px;">

    <!-- Poem -->
    <h2 style="font-family:Georgia,serif;color:#3d2a00;font-size:18px;font-weight:400;margin:0 0 16px;border-bottom:1px solid #e8c97a;padding-bottom:8px;">A Poem from ${pet_name}</h2>
    <blockquote style="margin:0 0 32px;padding:20px 24px;background:#fffbf0;border-left:4px solid #8B6914;border-radius:0 8px 8px 0;">
      <p style="font-family:Georgia,serif;font-style:italic;color:#3d2a00;font-size:15px;line-height:2;margin:0;">${poemLines}</p>
    </blockquote>

    <!-- Tribute -->
    <h2 style="font-family:Georgia,serif;color:#3d2a00;font-size:18px;font-weight:400;margin:0 0 16px;border-bottom:1px solid #e8c97a;padding-bottom:8px;">A Tribute to ${pet_name}</h2>
    <div style="margin:0 0 32px;">${tributeParagraphs}</div>

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${memorialUrl}" style="display:inline-block;background:#8B6914;color:#FFF8F0;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;font-family:sans-serif;">View ${pet_name}'s Memorial Page →</a>
      <p style="margin:12px 0 0;font-size:12px;color:#8B6914;">Share this permanent memorial page with friends and family</p>
    </div>

    <!-- Social Caption -->
    <div style="background:#fffbf0;border:1px solid #e8c97a;border-radius:8px;padding:20px 24px;margin:0 0 32px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8B6914;margin:0 0 8px;">Share on Social Media</p>
      <p style="font-size:14px;color:#3d2a00;line-height:1.7;margin:0;">${social_caption}</p>
    </div>

    <!-- Signature -->
    <div style="padding-top:20px;border-top:1px solid #e8c97a;display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" />
      <div style="font-size:13px;color:#5a3e00;">
        <strong style="color:#3d2a00;">Matt Michels</strong><br>
        Grosse Pointe, MI · M² Development
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;background:#f5e6cc;text-align:center;">
    <p style="margin:0;color:#8B6914;font-size:11px;">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
  </div>

</div>
</body>
</html>`;

    if (RESEND_API_KEY && customer_email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [customer_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `Your memorial for ${pet_name} is ready`,
          html: emailHtml,
        }),
      });

      // Mark email sent
      if (submission_id) {
        await sb.from("pet_memorial_submissions").update({ email_sent: true }).eq("id", submission_id);
      }

      // Notify Matt
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          subject: `Pet memorial delivered — ${pet_name} for ${customer_email}`,
          html: `<p>Memorial generated and sent.<br><strong>Pet:</strong> ${pet_name}<br><strong>Customer:</strong> ${customer_name || customer_email}<br><strong>Email:</strong> ${customer_email}<br><strong>Slug:</strong> ${slug}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, slug }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GENERATE-PET-MEMORIAL] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
