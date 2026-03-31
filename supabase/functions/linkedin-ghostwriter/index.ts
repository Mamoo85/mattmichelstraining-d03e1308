// LinkedIn Ghostwriter — Weekly Content Generator
// Called Monday 8am ET by cron — generates 5 posts for each active client

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get all active LinkedIn ghostwriting clients
  const { data: clients, error } = await sb
    .from("linkedin_ghostwriting_clients")
    .select("*")
    .eq("active", true);

  if (error || !clients || clients.length === 0) {
    console.log("[LINKEDIN-GHOSTWRITER] No active clients found");
    return new Response(JSON.stringify({ success: true, clients_processed: 0 }), { status: 200 });
  }

  console.log(`[LINKEDIN-GHOSTWRITER] Processing ${clients.length} clients`);

  let processed = 0;

  for (const client of clients) {
    try {
      // Generate 5 LinkedIn posts using AI
      const posts = await generatePosts(client);

      // Send email with all 5 posts
      if (RESEND_API_KEY) {
        const emailHTML = buildEmailTemplate(client.name, posts);

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "M² Content <matt@notify.m2training.com>",
            to: [client.email],
            subject: `Your LinkedIn Posts for This Week (${new Date().toLocaleDateString()})`,
            html: emailHTML + EMAIL_SIGNATURE,
          }),
        });

        // Update last_post_sent_at
        await sb
          .from("linkedin_ghostwriting_clients")
          .update({ last_post_sent_at: new Date().toISOString() })
          .eq("id", client.id);

        processed++;
      }
    } catch (e) {
      console.error(`[LINKEDIN-GHOSTWRITER] Error for ${client.email}:`, e);
    }
  }

  console.log(`[LINKEDIN-GHOSTWRITER] Sent posts to ${processed} clients`);

  return new Response(
    JSON.stringify({ success: true, clients_processed: processed }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

async function generatePosts(client: any): Promise<string[]> {
  const prompt = `You are a LinkedIn ghostwriter for ${client.name}, who works in ${client.industry || "their industry"}.

Tone: ${client.tone || "professional"}
Topics they care about: ${client.topics || "industry trends, tips, insights"}

Generate exactly 5 LinkedIn posts (one for each weekday). Each post should:
- Be 100-200 words
- Start with a hook that stops scrolling
- Use short paragraphs (1-2 sentences each)
- Include a call-to-action question at the end
- Sound like a real person, not marketing copy
- Be relevant to their industry

Format your response as:
POST 1:
[content here]

POST 2:
[content here]

... and so on for all 5 posts.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse posts from response
    const posts = content
      .split(/POST \d+:/gi)
      .slice(1) // Remove empty first element
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    return posts.slice(0, 5); // Ensure exactly 5
  } catch (e) {
    console.error("[LINKEDIN-GHOSTWRITER] AI generation error:", e);
    return [
      "Sorry, we couldn't generate your posts this week. Please contact support.",
    ];
  }
}

function buildEmailTemplate(name: string, posts: string[]): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const postBlocks = posts
    .map((post, i) => {
      return `
      <div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-left: 4px solid #e8621a;">
        <p style="margin: 0 0 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666; letter-spacing: 1px;">${days[i] || `Day ${i + 1}`}</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333; white-space: pre-line;">${post}</p>
      </div>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your LinkedIn Posts</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 10px;">Your LinkedIn Posts</h1>
    <p style="margin: 0 0 30px; font-size: 14px; color: #666;">Hi ${name}, here are your 5 posts for this week. Copy, paste, post — done.</p>

    ${postBlocks}

    <div style="margin-top: 30px; padding: 20px; background: #1e293b; color: #fff; text-align: center;">
      <p style="margin: 0 0 10px; font-size: 14px;">Not quite right? Reply to this email with feedback and we'll adjust future posts.</p>
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Questions? Text Matt: <a href="tel:+13138064952" style="color: #e8621a;">(313) 806-4952</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
