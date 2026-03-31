import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };


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

async function generatePressRelease(businessName: string, industry: string, city: string): Promise<string> {
  const prompt = `Write a professional press release for ${businessName}, a ${industry} business in ${city}. The press release should announce their services and value proposition. Include: PRESS RELEASE header, FOR IMMEDIATE RELEASE, dateline, compelling headline, lead paragraph (who/what/where/when/why), 2-3 body paragraphs, boilerplate about the company, and contact info placeholder. Format as plain text, ready to submit to media.`;

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
  const data = await res.json();
  return data?.choices?.[0]?.message?.content as string;
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
      city: string;
      release_count: number;
    }> = await supabaseQuery("press_release_clients?select=*&active=eq.true");

    let sent = 0;

    for (const client of clients) {
      try {
        const pressReleaseText = await generatePressRelease(client.business_name, client.industry, client.city);

        // Email the client their press release
        await sendEmail(
          client.email,
          `Your AI Press Release is Ready — ${client.business_name}`,
          `<p>Hi there! Here is your AI-written press release for <strong>${client.business_name}</strong>. It is ready to submit to local media outlets, PR wire services, or post on your website.</p>
          <hr />
          <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;line-height:1.6;">${pressReleaseText}</pre>
          <hr />
          <p style="color:#888;font-size:12px;">Powered by M2 Training AI Content Services | <a href="https://www.mattmichelstraining.com">mattmichelstraining.com</a></p>`
        );

        // Notify Matt
        await sendEmail(
          "matt@m2training.com",
          `Press Release Sent — ${client.business_name}`,
          `<p>Press release successfully generated and sent to <strong>${client.email}</strong> for ${client.business_name} (${client.industry}, ${client.city}).</p>
          <hr />
          <pre style="white-space:pre-wrap;">${pressReleaseText}</pre>`
        );

        // Update release_count and last_released_at
        await supabaseQuery(
          `press_release_clients?id=eq.${client.id}`,
          { release_count: (client.release_count || 0) + 1, last_released_at: new Date().toISOString() },
          "PATCH"
        );

        sent++;
      } catch (clientErr: any) {
        console.error(`Error processing press release for ${client.email}:`, clientErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" } });
  }
});
