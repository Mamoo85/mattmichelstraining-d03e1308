import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function supabaseQuery(path: string, body?: unknown, method = "GET") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${text}`);
  }
  if (method === "GET") return res.json();
  return null;
}

async function generateBlogPost(businessName: string, industry: string, website?: string): Promise<string> {
  const websitePart = website ? ` (website: ${website})` : "";
  const prompt = `Write a complete, engaging 400-500 word blog post for ${businessName}, a ${industry} business${websitePart}. Include: an attention-grabbing title, intro paragraph, 3 value-packed sections with subheadings, and a clear call-to-action. Format as clean HTML with h1, h2, p tags.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error: ${text}`);
  }
  const data = await res.json();
  return data.content[0].text as string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "M2 Training <matt@notify.m2training.com>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error: ${text}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const clients: Array<{
      id: string;
      email: string;
      business_name: string;
      industry: string;
      website?: string;
      post_count: number;
    }> = await supabaseQuery("blog_post_clients?select=*&active=eq.true");

    let sent = 0;

    for (const client of clients) {
      try {
        const blogHtml = await generateBlogPost(client.business_name, client.industry, client.website);

        // Email the client their blog post
        await sendEmail(
          client.email,
          `Your AI Blog Post is Ready — ${client.business_name}`,
          `<p>Hi there! Here is your fresh AI-written blog post for <strong>${client.business_name}</strong>. Copy and paste it into your website or blog.</p>
          <hr />
          ${blogHtml}
          <hr />
          <p style="color:#888;font-size:12px;">Powered by M2 Training AI Content Services | <a href="https://www.mattmichelstraining.com">mattmichelstraining.com</a></p>`
        );

        // Notify Matt
        await sendEmail(
          "matt@m2training.com",
          `Blog Post Sent — ${client.business_name}`,
          `<p>Blog post successfully generated and sent to <strong>${client.email}</strong> for ${client.business_name} (${client.industry}).</p>
          <hr />
          ${blogHtml}`
        );

        // Update post_count and last_posted_at
        await supabaseQuery(
          `blog_post_clients?id=eq.${client.id}`,
          { post_count: (client.post_count || 0) + 1, last_posted_at: new Date().toISOString() },
          "PATCH"
        );

        sent++;
      } catch (clientErr: any) {
        console.error(`Error processing blog post for ${client.email}:`, clientErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
