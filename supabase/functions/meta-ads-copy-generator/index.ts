import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface Service {
  name: string;
  price: string;
  target: string;
}

const SERVICES: Service[] = [
  { name: "Missed Call Text-Back", price: "$99/mo", target: "contractors, HVAC, plumbing, roofing" },
  { name: "AI Reputation Dashboard", price: "$79/mo", target: "restaurants, dental, retail" },
  { name: "Text Message Marketing", price: "$79/mo", target: "restaurants, salons, gyms, retail" },
  { name: "Review Request SMS", price: "$39/mo", target: "any local service business" },
  { name: "AI Phone Answering", price: "$149/mo", target: "contractors, real estate, legal" },
  { name: "Quote Follow-Up SMS", price: "$49/mo", target: "contractors, HVAC, roofing" },
  { name: "AI Blog Post Service", price: "$79/mo", target: "any small business with a website" },
  { name: "AI Social Caption Pack", price: "$29/mo", target: "restaurants, gyms, salons" },
  { name: "AI Competitor Watch", price: "$69/mo", target: "competitive local businesses" },
  { name: "Speed-to-Lead SMS", price: "$39/mo", target: "any business with a website form" },
  { name: "AI Hiring Assistant", price: "$49/mo", target: "small businesses hiring" },
  { name: "Late Payment Chaser", price: "$29/mo", target: "contractors, landscaping, cleaning" },
];

interface AdCopy {
  facebook: Array<{ headline: string; primaryText: string }>;
  instagram: string;
}

async function generateAdCopy(service: Service): Promise<AdCopy> {
  const prompt = `Generate ad copy for: ${service.name} (${service.price})
Target audience: ${service.target}

Output EXACTLY this JSON structure (no extra text, no markdown):
{
  "facebook": [
    { "headline": "...", "primaryText": "..." },
    { "headline": "...", "primaryText": "..." },
    { "headline": "...", "primaryText": "..." }
  ],
  "instagram": "caption with hashtags"
}

Rules:
- Each Facebook headline: under 150 chars
- Each Facebook primaryText: under 300 chars
- Use pain points and specific CTAs
- Instagram caption ends with 5-8 relevant hashtags
- Focus on Metro Detroit small businesses`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: "You are a direct response copywriter. Write Facebook/Instagram ads for small local businesses in Metro Detroit. Use pain points, specifics, and clear CTAs. No fluff.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content[0].text.trim();

  try {
    return JSON.parse(raw) as AdCopy;
  } catch {
    // Fallback if JSON parse fails
    return {
      facebook: [
        { headline: `${service.name} — ${service.price}`, primaryText: `Automate your ${service.name.toLowerCase()} starting today. Built for ${service.target}. Text Matt: (313) 806-4952` },
        { headline: `Stop losing money on ${service.name.toLowerCase()}`, primaryText: `Local businesses in Metro Detroit trust us to handle it automatically. Try free for 7 days.` },
        { headline: `${service.price}/mo — No contracts`, primaryText: `${service.name} done for you. Perfect for ${service.target}. See it at mattmichelstraining.com` },
      ],
      instagram: `Running a local business is hard enough. Let us handle your ${service.name.toLowerCase()} automatically for ${service.price}/mo. DM us or visit mattmichelstraining.com 📲 #MetroDetroit #SmallBusiness #LocalBusiness #BusinessAutomation #Detroit`,
    };
  }
}

function buildServiceHtml(service: Service, ads: AdCopy, index: number): string {
  const fbRows = ads.facebook.map((v, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#ffffff"};">
      <td style="padding:10px 14px;font-weight:600;color:#1e293b;border-bottom:1px solid #e5e7eb;">Variant ${i + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">📌 Headline</div>
        <div style="color:#374151;">${escapeHtml(v.headline)}</div>
        <div style="font-weight:600;color:#1e293b;margin-top:8px;margin-bottom:4px;">📝 Primary Text</div>
        <div style="color:#374151;">${escapeHtml(v.primaryText)}</div>
      </td>
    </tr>`).join("");

  return `
  <div style="margin-bottom:40px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#e8621a;padding:14px 20px;">
      <span style="color:#ffffff;font-size:16px;font-weight:700;">${index + 1}. ${escapeHtml(service.name)}</span>
      <span style="color:#fcd9c0;font-size:14px;margin-left:12px;">${escapeHtml(service.price)} — Target: ${escapeHtml(service.target)}</span>
    </div>

    <div style="padding:16px 20px 8px;">
      <div style="font-weight:700;color:#1e293b;margin-bottom:10px;font-size:14px;text-transform:uppercase;letter-spacing:.5px;">Facebook Ad Variants</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${fbRows}
      </table>
    </div>

    <div style="padding:16px 20px 20px;">
      <div style="font-weight:700;color:#1e293b;margin-bottom:8px;font-size:14px;text-transform:uppercase;letter-spacing:.5px;">Instagram Caption</div>
      <div style="background:#f3f4f6;border-radius:6px;padding:12px 14px;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(ads.instagram)}</div>
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

async function sendEmail(html: string, date: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@notify.m2training.com>",
      to: ["matt@m2training.com"],
      subject: "Your weekly ad copy — ready to paste into Meta Ads Manager",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Weekly Ad Copy</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:780px;margin:0 auto;padding:32px 16px;">

    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:24px 28px;margin-bottom:0;">
      <div style="color:#e8621a;font-size:22px;font-weight:800;margin-bottom:4px;">M² Performance Training</div>
      <div style="color:#94a3b8;font-size:14px;">Weekly Ad Copy Report — ${escapeHtml(date)}</div>
    </div>

    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px 24px;margin-bottom:24px;">
      <p style="color:#374151;margin:0 0 8px;font-size:15px;">Matt,</p>
      <p style="color:#374151;margin:0 0 0;font-size:15px;">Here's your weekly batch of ad copy for all 12 services — ready to copy/paste directly into Meta Ads Manager. Each service has 3 Facebook variants and 1 Instagram caption.</p>
    </div>

    ${html}

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
    const date = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const results: Array<{ service: Service; ads: AdCopy }> = [];

    for (const service of SERVICES) {
      const ads = await generateAdCopy(service);
      results.push({ service, ads });
    }

    const sectionsHtml = results
      .map(({ service, ads }, i) => buildServiceHtml(service, ads, i))
      .join("\n");

    await sendEmail(sectionsHtml, date);

    return new Response(
      JSON.stringify({ ok: true, services: 12 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("meta-ads-copy-generator error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
