import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// AI response type
// uses OpenAI-compatible format



const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

async function supabaseQuery(path: string, body?: unknown, method = "GET") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "return=representation" : "return=minimal" },
    body: body ? JSON.stringify(body) : undefined });
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

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: prompt }] }) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error: ${text}`);
  }
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M2 Training <matt@mattmichelstraining.com>",
      to,
      bcc: ["matthewmichels4@gmail.com"],
      subject,
      html }) });
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
          "matt@mattmichelstraining.com",
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
      } catch (clientErr) {
        const message = clientErr instanceof Error ? clientErr.message : String(clientErr);
        console.error(`Error processing blog post for ${client.email}:`, message);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" } });
  }
});
