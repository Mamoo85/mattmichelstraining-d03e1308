// Podcast Content Generator
// Runs on a cron every 6 hours.
// For each active podcast_clients row, fetches the RSS feed, finds new episodes,
// generates 5 content pieces via Claude, stores them, and emails the customer.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface PodcastClient {
  id: string;
  customer_email: string;
  customer_name: string | null;
  podcast_name: string | null;
  rss_feed_url: string;
  podcast_niche: string | null;
  target_audience: string | null;
  tone: string;
  last_episode_guid: string | null;
}

interface GeneratedContent {
  blog_post: string;
  linkedin_post: string;
  email_newsletter: string;
  youtube_description: string;
  twitter_thread: string;
}

// ── RSS Parsing ───────────────────────────────────────────────────────────────
function getElementText(el: Element, tag: string): string {
  const found = el.querySelector(tag);
  return found?.textContent?.trim() || "";
}

function getCDataText(el: Element, tag: string): string {
  // Try namespaced content:encoded first, then plain tag
  const encoded = el.getElementsByTagName("content:encoded")[0];
  if (tag === "description" && encoded) return encoded.textContent?.trim() || "";
  return getElementText(el, tag);
}

interface RssEpisode {
  guid: string;
  title: string;
  description: string;
  url: string;
  pubDate: string;
}

function parseRssFeed(xmlText: string): RssEpisode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(doc.querySelectorAll("item"));

  return items.map((item) => {
    const guid = getElementText(item, "guid") || getElementText(item, "id") || "";
    const title = getElementText(item, "title");
    const description = getCDataText(item, "description");
    const url =
      item.querySelector("enclosure")?.getAttribute("url") ||
      getElementText(item, "link") ||
      "";
    const pubDate = getElementText(item, "pubDate");

    return { guid, title, description, url, pubDate };
  });
}

// ── Claude Content Generation ─────────────────────────────────────────────────
async function generateContent(
  episode: RssEpisode,
  client: PodcastClient
): Promise<GeneratedContent> {
  const toneDesc = {
    professional: "professional and authoritative",
    casual: "conversational and friendly",
    educational: "educational and informative",
    inspirational: "inspiring and motivational",
  }[client.tone] || "professional and authoritative";

  const systemPrompt = `You are a world-class content repurposing expert for podcasters.
Podcast: "${client.podcast_name || "Unknown Podcast"}"
Niche: ${client.podcast_niche || "general"}
Target audience: ${client.target_audience || "general listeners"}
Tone: ${toneDesc}

Generate content that sounds authentic, human, and specific to this episode. Never be generic.`;

  const userPrompt = `Episode title: ${episode.title}
Episode description/show notes:
${episode.description ? episode.description.slice(0, 2000) : "(no description available)"}

Generate exactly this JSON (no markdown fences, valid JSON only):
{
  "blog_post": "600-900 word SEO-optimized blog post. Use HTML heading tags (H2) for sections. Structure: compelling intro paragraph, 3-4 H2 sections with meaty content, conclusion with CTA. Include the episode title naturally. Write for the target audience.",
  "linkedin_post": "150-200 word LinkedIn post. Start with a scroll-stopping hook (no 'I' as first word). 3-4 short paragraphs. End with an engaging question. Use line breaks for readability. Professional but human tone.",
  "email_newsletter": "300-400 word email newsletter. Start with: Subject: [compelling subject line]\\n\\n then the body. Conversational tone, like writing to a friend. Reference the episode, give 2-3 key takeaways, link to listen. Warm sign-off.",
  "youtube_description": "200-300 word YouTube description. First 2 lines are the hook (visible before 'show more'). Then episode summary. Then: Timestamps:\\n• 00:00 Introduction\\n(add 3-5 more if context allows)\\n\\nThen 8-10 relevant #hashtags at the end.",
  "twitter_thread": "5-7 tweets as a thread. Format each as: '1/ [tweet text]' on its own line. First tweet: bold claim or surprising insight. Each under 280 chars. Last tweet: invite replies or shares."
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text || "";

  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(clean) as GeneratedContent;
  } catch {
    console.error("[PODCAST-GENERATOR] JSON parse failed, raw:", raw.slice(0, 500));
    throw new Error("Failed to parse Claude JSON response");
  }
}

// ── Email Builder ─────────────────────────────────────────────────────────────
function buildContentEmail(
  episode: RssEpisode,
  content: GeneratedContent,
  podcastName: string
): string {
  const accent = "#FF6B35";
  const dark = "#1a1a2e";
  const mid = "#16213e";

  function section(title: string, icon: string, body: string): string {
    return `
    <div style="margin-bottom:24px;border:1px solid #2d2d4e;border-radius:10px;overflow:hidden;">
      <div style="background:${mid};padding:14px 20px;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${accent};">
        <span style="font-size:18px;">${icon}</span>
        <span style="color:#ffffff;font-weight:700;font-size:14px;letter-spacing:.05em;text-transform:uppercase;">${title}</span>
      </div>
      <div style="background:#0f0f23;padding:20px;position:relative;">
        <div style="font-family:monospace;font-size:13px;color:#e2e8f0;line-height:1.8;white-space:pre-wrap;word-break:break-word;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2d2d4e;">
          <span style="display:inline-block;background:${accent};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:4px;letter-spacing:.05em;">COPY &amp; PASTE READY</span>
        </div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:660px;margin:0 auto;padding:20px 12px;">

  <!-- Header -->
  <div style="background:${dark};border-radius:12px;overflow:hidden;border:1px solid #2d2d4e;margin-bottom:8px;">
    <div style="background:linear-gradient(135deg,${dark} 0%,${mid} 100%);padding:28px 32px;border-bottom:3px solid ${accent};">
      <p style="color:${accent};font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 8px;">M² Development · Podcast-to-Revenue Machine</p>
      <h1 style="color:#ffffff;margin:0 0 6px;font-size:22px;line-height:1.3;">🎙️ Your content is ready!</h1>
      <p style="color:#94a3b8;margin:0;font-size:13px;line-height:1.5;"><strong style="color:#e2e8f0;">${podcastName}</strong> · ${episode.title}</p>
    </div>
    <div style="padding:16px 32px;background:${mid};">
      <p style="color:#64748b;font-size:12px;margin:0;">5 pieces of content — copy-paste ready. Your episode is already working harder for you.</p>
    </div>
  </div>

  <!-- Content Sections -->
  <div style="margin-top:20px;">
    ${section("Blog Post", "✍️", content.blog_post)}
    ${section("LinkedIn Post", "💼", content.linkedin_post)}
    ${section("Email Newsletter", "📧", content.email_newsletter)}
    ${section("YouTube Description", "▶️", content.youtube_description)}
    ${section("Twitter / X Thread", "🐦", content.twitter_thread)}
  </div>

  <!-- Footer -->
  <div style="padding:20px 0;text-align:center;border-top:1px solid #2d2d4e;margin-top:16px;">
    <p style="color:#475569;font-size:12px;margin:0 0 8px;">
      <strong style="color:#94a3b8;">Matt Michels</strong> · M² Development · Grosse Pointe, MI
    </p>
    <p style="color:#334155;font-size:11px;margin:0;">
      Questions? Reply to this email or text <a href="tel:+13138064952" style="color:${accent};">(313) 806-4952</a>
    </p>
    <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:32px;height:32px;margin-top:12px;object-fit:contain;opacity:.7;" />
  </div>

</div>
</body>
</html>`;
}

// ── Core processing logic ─────────────────────────────────────────────────────
async function processClient(client: PodcastClient, sb: ReturnType<typeof createClient>): Promise<void> {
  console.log(`[PODCAST-GENERATOR] Processing client ${client.id} — ${client.podcast_name || client.customer_email}`);

  // Fetch RSS feed
  let xmlText: string;
  try {
    const feedRes = await fetch(client.rss_feed_url, {
      headers: { "User-Agent": "M2-Podcast-Bot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!feedRes.ok) throw new Error(`RSS fetch ${feedRes.status}`);
    xmlText = await feedRes.text();
  } catch (e) {
    console.error(`[PODCAST-GENERATOR] RSS fetch failed for ${client.id}:`, e);
    return;
  }

  // Parse episodes
  const episodes = parseRssFeed(xmlText);
  if (episodes.length === 0) {
    console.log(`[PODCAST-GENERATOR] No episodes found for ${client.id}`);
    await (sb.from as any)("podcast_clients").update({ last_checked_at: new Date().toISOString() }).eq("id", client.id);
    return;
  }

  // Find new episodes (not yet in DB)
  const { data: existingRows } = await (sb.from as any)("podcast_episodes")
    .select("episode_guid")
    .eq("client_id", client.id);

  const existingGuids = new Set<string>((existingRows || []).map((r: any) => r.episode_guid));

  const newEpisodes = episodes.filter(
    (ep) => ep.guid && !existingGuids.has(ep.guid) && ep.guid !== client.last_episode_guid
  );

  if (newEpisodes.length === 0) {
    console.log(`[PODCAST-GENERATOR] No new episodes for ${client.id}`);
    await (sb.from as any)("podcast_clients").update({ last_checked_at: new Date().toISOString() }).eq("id", client.id);
    return;
  }

  console.log(`[PODCAST-GENERATOR] Found ${newEpisodes.length} new episode(s) for ${client.id}`);

  // Process each new episode (most recent first, limit 3 per run to avoid timeout)
  const toProcess = newEpisodes.slice(0, 3);

  for (const episode of toProcess) {
    try {
      console.log(`[PODCAST-GENERATOR] Generating content for: ${episode.title}`);

      const content = await generateContent(episode, client);

      // Store in DB
      const { error: insertErr } = await (sb.from as any)("podcast_episodes").insert({
        client_id: client.id,
        episode_guid: episode.guid,
        episode_title: episode.title,
        episode_description: episode.description?.slice(0, 5000) || null,
        episode_url: episode.url || null,
        published_at: episode.pubDate ? new Date(episode.pubDate).toISOString() : null,
        blog_post: content.blog_post,
        linkedin_post: content.linkedin_post,
        email_newsletter: content.email_newsletter,
        youtube_description: content.youtube_description,
        twitter_thread: content.twitter_thread,
        content_sent: false,
      });

      if (insertErr) {
        console.error(`[PODCAST-GENERATOR] Insert failed for episode ${episode.guid}:`, insertErr);
        continue;
      }

      // Send email to customer
      if (RESEND_API_KEY && client.customer_email) {
        const emailHtml = buildContentEmail(episode, content, client.podcast_name || "Your Podcast");
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [client.customer_email],
            bcc: ["matthewmichels4@gmail.com"],
            subject: `🎙️ Your "${episode.title}" content is ready!`,
            html: emailHtml,
          }),
        });
        if (!emailRes.ok) {
          console.error(`[PODCAST-GENERATOR] Email send failed:`, await emailRes.text());
        } else {
          // Mark as sent
          await (sb.from as any)("podcast_episodes")
            .update({ content_sent: true })
            .eq("client_id", client.id)
            .eq("episode_guid", episode.guid);
        }
      }

      // Update client's last episode info
      await (sb.from as any)("podcast_clients").update({
        last_episode_guid: episode.guid,
        last_checked_at: new Date().toISOString(),
      }).eq("id", client.id);

    } catch (e) {
      console.error(`[PODCAST-GENERATOR] Error processing episode ${episode.guid}:`, e);
    }
  }
}

// ── Serve ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Optional: single client_id from body (used for fire-and-forget on signup)
    let singleClientId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        singleClientId = body?.client_id || null;
      } catch { /* ignore */ }
    }

    // Fetch active clients
    let query = (sb.from as any)("podcast_clients")
      .select("id, customer_email, customer_name, podcast_name, rss_feed_url, podcast_niche, target_audience, tone, last_episode_guid")
      .eq("subscription_status", "active");

    if (singleClientId) {
      query = query.eq("id", singleClientId);
    }

    const { data: clients, error } = await query;

    if (error) {
      console.error("[PODCAST-GENERATOR] DB fetch error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process all clients (sequential to respect API rate limits)
    let processed = 0;
    for (const client of clients as PodcastClient[]) {
      await processClient(client, sb);
      processed++;
    }

    console.log(`[PODCAST-GENERATOR] Completed. Processed ${processed} client(s).`);
    return new Response(JSON.stringify({ processed }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PODCAST-GENERATOR] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
