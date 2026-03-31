import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// 3 themes per bucket, rotate by month within each bucket
const THEME_BUCKETS: Record<string, string[]> = {
  "local-service": [
    "missed calls and how auto text-back saves local service businesses revenue",
    "online reviews and how automating review requests grows local business reputation",
    "text message marketing for local service businesses — restaurants, salons, and gyms",
    "AI phone answering for local businesses — never miss a lead again",
  ],
  "contractor-ai": [
    "AI tools for contractors to automate estimates and follow-up",
    "invoice and payment automation for small contractors and landscapers",
    "AI hiring assistants — how small businesses hire faster with automation",
    "lead follow-up automation for HVAC, roofing, and plumbing contractors",
  ],
  "digital-marketing": [
    "local SEO strategies for Michigan small businesses in 2025",
    "social media automation for small businesses — save time and stay consistent",
    "Facebook and Instagram ad copy tips for local service businesses",
    "email marketing automation for small business owners in Metro Detroit",
  ],
};

function getBucketAndThemes(month: number): { bucket: string; themes: string[] } {
  // month is 1-based
  if (month <= 4) return { bucket: "local-service", themes: THEME_BUCKETS["local-service"] };
  if (month <= 8) return { bucket: "contractor-ai", themes: THEME_BUCKETS["contractor-ai"] };
  return { bucket: "digital-marketing", themes: THEME_BUCKETS["digital-marketing"] };
}

// Pick 3 themes from the 4 in the bucket using the month as an offset so we rotate
function pickThemes(bucket: string, month: number): string[] {
  const all = THEME_BUCKETS[bucket];
  const offset = (month - 1) % all.length; // 0-3
  const picks: string[] = [];
  for (let i = 0; i < 3; i++) {
    picks.push(all[(offset + i) % all.length]);
  }
  return picks;
}

interface BlogPost {
  seoTitle: string;
  metaDescription: string;
  html: string;
}

async function generateBlogPost(theme: string, monthName: string): Promise<BlogPost> {
  const prompt = `Write an SEO-optimized blog post for Matt Michels at mattmichelstraining.com.

Topic: ${theme}
Target keyword style: "small business [service] Michigan" or similar local SEO phrase
Month context: ${monthName}

Output EXACTLY this JSON (no markdown fences, no extra text):
{
  "seoTitle": "...",
  "metaDescription": "...",
  "html": "..."
}

Requirements:
- seoTitle: compelling, includes a Michigan/Metro Detroit keyword, under 65 chars
- metaDescription: exactly 155 chars or under, includes primary keyword
- html: full blog post body HTML (~600 words), include:
    * <h1> with the SEO title
    * Intro paragraph (2-3 sentences, hook the reader with a pain point)
    * 3-4 sections each with <h2> or <h3> headers
    * Conclusion paragraph with a CTA that links to https://mattmichelstraining.com/all-services using anchor text "see all of Matt's services"
    * Conversational but credible tone — Matt is a Metro Detroit guy with 10+ years B2B sales experience
    * No keyword stuffing, natural language
    * Do NOT include <html>, <head>, or <body> tags — just the article body content`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: "You are an SEO content writer specializing in small business automation and local marketing in Michigan. Write in a practical, conversational tone. Always output valid JSON exactly as requested.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content[0].text.trim();

  try {
    return JSON.parse(raw) as BlogPost;
  } catch {
    // Fallback post on parse failure
    return {
      seoTitle: `How Michigan Small Businesses Use AI Automation — ${monthName}`,
      metaDescription: `Metro Detroit small business owners are using AI automation to save time and grow revenue. Here's how ${theme.split(" ").slice(0, 5).join(" ")} can help.`,
      html: `<h1>How Michigan Small Businesses Use AI Automation</h1>
<p>Running a small business in Metro Detroit is no joke. Between managing customers, chasing leads, and keeping up with daily operations, it can feel like there's never enough hours in the day. That's where automation comes in.</p>
<h2>The Problem Most Small Businesses Face</h2>
<p>Most local business owners are leaving money on the table simply because they don't have time to follow up, respond quickly, or stay consistent with their marketing. The good news? There are tools built specifically to handle this for you — automatically.</p>
<h2>What AI Automation Actually Looks Like</h2>
<p>We're not talking about complicated software that takes months to set up. These are simple, done-for-you systems that handle the repetitive tasks so you can focus on running your business. Think automatic text replies, review requests, and follow-up sequences — all running in the background 24/7.</p>
<h2>Results Local Businesses Are Seeing</h2>
<p>Contractors, restaurants, and service businesses across Michigan are using automation to respond faster, collect more reviews, and close more jobs without hiring extra staff. The ROI is real and measurable.</p>
<h2>Getting Started</h2>
<p>You don't need a big budget or a tech background to get started. Most of these tools take less than a week to set up and pay for themselves in the first month.</p>
<p>Ready to see what's available? <a href="https://mattmichelstraining.com/all-services">See all of Matt's services</a> and find the right fit for your business.</p>`,
    };
  }
}

function buildPostSection(post: BlogPost, index: number): string {
  return `
  <div style="margin-bottom:48px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#1e293b;padding:16px 22px;">
      <div style="color:#e8621a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Blog Post ${index + 1}</div>
      <div style="color:#f1f5f9;font-size:17px;font-weight:700;">${escapeHtml(post.seoTitle)}</div>
    </div>

    <div style="background:#f8fafc;padding:14px 22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:6px;">SEO Title (paste into Yoast/RankMath)</div>
      <div style="font-size:14px;color:#1e293b;font-weight:600;">${escapeHtml(post.seoTitle)}</div>
    </div>

    <div style="background:#f8fafc;padding:14px 22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:6px;">Meta Description (paste into Yoast/RankMath)</div>
      <div style="font-size:14px;color:#374151;">${escapeHtml(post.metaDescription)}</div>
      <div style="font-size:11px;color:${post.metaDescription.length > 155 ? "#dc2626" : "#16a34a"};margin-top:4px;">${post.metaDescription.length} chars ${post.metaDescription.length > 155 ? "⚠ over 155" : "✓"}</div>
    </div>

    <div style="padding:22px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:12px;">Full Post HTML — Paste into WordPress / Page Builder</div>
      <div style="background:#0f172a;border-radius:6px;padding:16px;overflow-x:auto;">
        <pre style="margin:0;color:#e2e8f0;font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(post.html)}</pre>
      </div>
    </div>

    <div style="background:#fff7ed;border-top:1px solid #fed7aa;padding:14px 22px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9a3412;margin-bottom:6px;">Preview (how it will look)</div>
      <div style="font-size:14px;color:#374151;line-height:1.7;">${post.html}</div>
    </div>
  </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(sectionsHtml: string, monthName: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@notify.m2training.com>",
      to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
      subject: `Your 3 SEO blog posts for ${monthName} — ready to publish`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Monthly SEO Blog Posts</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:820px;margin:0 auto;padding:32px 16px;">

    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:24px 28px;">
      <div style="color:#e8621a;font-size:22px;font-weight:800;margin-bottom:4px;">M² Performance Training</div>
      <div style="color:#94a3b8;font-size:14px;">Monthly SEO Blog Posts — ${escapeHtml(monthName)}</div>
    </div>

    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:24px 24px 8px;margin-bottom:24px;">
      <p style="color:#374151;margin:0 0 8px;font-size:15px;">Matt,</p>
      <p style="color:#374151;margin:0 0 8px;font-size:15px;">Here are your 3 SEO blog posts for ${escapeHtml(monthName)}. Each post includes:</p>
      <ul style="color:#374151;font-size:15px;margin:0 0 8px;padding-left:20px;">
        <li>SEO title and meta description ready to paste into Yoast or RankMath</li>
        <li>Full post HTML (~600 words) ready to paste into WordPress</li>
        <li>A rendered preview so you can see how it reads before publishing</li>
      </ul>
      <p style="color:#374151;margin:0 0 0;font-size:15px;">Aim to publish 1 per week (skip the 4th week). Consistent publishing = compounding SEO growth.</p>
    </div>

    ${sectionsHtml}

    <div style="background:#1e293b;border-radius:8px;padding:20px 24px;text-align:center;">
      <div style="color:#94a3b8;font-size:13px;">mattmichelstraining.com &nbsp;|&nbsp; (313) 806-4952 &nbsp;|&nbsp; matt@m2training.com</div>
    </div>

  </div>
</body>
</html>`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error: ${response.status} — ${err}`);
  }
}

serve(async (_req) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-based
    const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const { bucket, themes: _themes } = getBucketAndThemes(month);
    const themes = pickThemes(bucket, month);

    const posts: BlogPost[] = [];
    for (const theme of themes) {
      const post = await generateBlogPost(theme, monthName);
      posts.push(post);
    }

    const sectionsHtml = posts
      .map((post, i) => buildPostSection(post, i))
      .join("\n");

    await sendEmail(sectionsHtml, monthName);

    return new Response(
      JSON.stringify({ ok: true, month: monthName, posts: posts.length, bucket }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("seo-blog-publisher error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
