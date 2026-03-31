// Industrial Newsletter Send — Monday 9am ET (13:00 UTC)
// 1. Fetches top industry headlines from RSS feeds
// 2. Claude Haiku writes a 500-word Monday briefing with 5 actionable insights
// 3. Sends to b2b_subscribers where niche = 'industrial_newsletter' AND active = true

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const RSS_FEEDS = [
  "https://www.thomasnet.com/articles/feed/",
  "https://www.industryweek.com/rss",
];

interface RssItem {
  title: string;
  description: string;
}

async function fetchRssHeadlines(): Promise<RssItem[]> {
  const items: RssItem[] = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "M2Training/1.0 newsletter-bot" },
        signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemMatches = xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g);
      let count = 0;
      for (const match of itemMatches) {
        if (count >= 3) break;
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const descMatch = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
        const title = (titleMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
        const description = (descMatch?.[1] || "").replace(/<[^>]+>/g, "").trim().slice(0, 200);
        if (title) {
          items.push({ title, description });
          count++;
        }
      }
    } catch {
      // Continue to next feed on failure
    }
  }

  return items.slice(0, 5);
}

async function generateBriefing(headlines: RssItem[]): Promise<{ subject: string; body: string; preview: string }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const headlineText = headlines.length > 0
    ? headlines.map((h, i) => `${i + 1}. ${h.title}${h.description ? " — " + h.description : ""}`).join("\n")
    : "No live headlines available this week. Use general industrial/manufacturing market trends.";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{
        role: "user",
        content: `You are a sales intelligence analyst for industrial/manufacturing B2B sales reps. Here are this week's top industry headlines:

${headlineText}

Write a 500-word Monday morning briefing with 5 actionable sales intelligence insights these reps can use THIS WEEK to prospect and close deals. Be specific. Include company names, industries, and real tactics. Each insight should have a bold headline and 2-3 sentences of action-oriented advice.

Format as JSON with:
- subject: email subject line under 60 chars (punchy, urgent)
- preview: one-line preview under 100 chars
- briefing: the full 500-word briefing in HTML (use <h3> for each insight headline, <p> for body, no inline styles)

Return only valid JSON.` }] }) });

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";

  let parsed: { subject: string; preview: string; briefing: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || raw);
  } catch {
    parsed = {
      subject: "Industrial Sales Intel — Monday Briefing",
      preview: "5 moves to make this week in manufacturing sales.",
      briefing: `<p>${raw.slice(0, 1500)}</p>` };
  }

  return { subject: parsed.subject, body: parsed.briefing, preview: parsed.preview };
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json")
      ? await req.json().catch(() => ({}))
      : {};

    const previewOnly = body?.preview_only === true;

    const headlines = await fetchRssHeadlines();
    const { subject, body: briefingHtml, preview } = await generateBriefing(headlines);

    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const issueNum = (weekNumber % 52) + 1;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <!-- Header -->
  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Industrial Sales Intel</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Issue #${issueNum} · ${dateStr}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.6;">Good morning. Here are 5 things happening in industrial and manufacturing markets that you can use to prospect and close deals this week.</p>

    <div style="font-size:15px;color:#334155;line-height:1.9;">
${briefingHtml
  .replace(/<h3>/g, '<h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:20px 0 6px;border-left:3px solid #e8621a;padding-left:10px;">')
  .replace(/<p>/g, '<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">')}
    </div>

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">See a trend worth covering? Reply to this email or text Matt at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>

  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;line-height:1.6;">
    M² Performance Training · <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a><br>
    <a href="${SUPABASE_URL}/functions/v1/newsletter-unsubscribe?token={{unsubscribe_token}}" style="color:#94a3b8;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    if (previewOnly) {
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Industrial Intel <matt@mattmichelstraining.com>",
            to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
            subject: `[PREVIEW] ${subject}`,
            html: html.replace("{{unsubscribe_token}}", "preview") }) });
      }
      return new Response(JSON.stringify({ preview_sent: true, subject }), { status: 200 });
    }

    const { data: subscribers } = await sb
      .from("b2b_subscribers")
      .select("email, name, unsubscribe_token")
      .eq("niche", "industrial_newsletter")
      .eq("active", true);

    if (!subscribers || subscribers.length === 0) {
      console.log("[INDUSTRIAL-NEWSLETTER] No subscribers yet.");
      return new Response(JSON.stringify({ sent: 0, subject }), { status: 200 });
    }

    let sent = 0;
    const batchSize = 50;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((sub) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [sub.email], bcc: ["matthewmichels4@gmail.com"],
              subject,
              html: html.replace("{{unsubscribe_token}}", sub.unsubscribe_token || "") }) })
        )
      );
      sent += batch.length;
    }

    console.log(`[INDUSTRIAL-NEWSLETTER] Sent to ${sent} subscribers — "${subject}"`);
    return new Response(JSON.stringify({ sent, subject }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[INDUSTRIAL-NEWSLETTER] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
