// re-newsletter-send — called weekly by cron
// For each active client + each of their zip codes:
//   1. Attempt to fetch Zillow market data (scrape) — likely fails, falls through
//   2. Claude Haiku generates plausible local market commentary for the zip + season
//   3. Claude generates subject, market snapshot, buyer/seller paragraphs, local insight, CTA
//   4. Builds HTML email branded with agent's colors, name, brokerage, contact info
//   5. Sends via Resend to all contacts for this client
//   6. Stores issue in re_newsletter_issues

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface NewsletterContent {
  subject: string;
  marketHeadline: string;
  marketSnapshot: string;
  buyerParagraph: string;
  sellerParagraph: string;
  localInsight: string;
  ctaText: string;
  medianPrice: string;
  priceChange: string;
  daysOnMarket: string;
  inventory: string;
}

function getSeason(): string {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getMonthYear(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Attempt Zillow scrape — returns null on failure (expected)
async function tryFetchZillowData(zip: string): Promise<{ medianPrice?: string; dom?: string } | null> {
  try {
    const res = await fetch(`https://www.zillow.com/homes/${zip}_rb/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try to scrape median list price
    const priceMatch = html.match(/median[^"]*list[^"]*price[^$]*\$([0-9,]+)/i);
    const domMatch = html.match(/(\d+)\s*days?\s*on\s*(?:zillow|market)/i);

    if (priceMatch || domMatch) {
      return {
        medianPrice: priceMatch ? `$${priceMatch[1]}` : undefined,
        dom: domMatch ? domMatch[1] : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function generateNewsletterContent(
  zip: string,
  agentName: string,
  brokerage: string,
  zillowData: { medianPrice?: string; dom?: string } | null
): Promise<NewsletterContent> {
  if (!ANTHROPIC_API_KEY) throw new Error("No ANTHROPIC_API_KEY");

  const season = getSeason();
  const monthYear = getMonthYear();

  const zillowContext = zillowData
    ? `Available market data for ${zip}: Median list price around ${zillowData.medianPrice || "unknown"}, approximately ${zillowData.dom || "unknown"} days on market.`
    : `No live data available — generate realistic, plausible market statistics for zip code ${zip} based on typical ${season} real estate market conditions.`;

  const prompt = `You are writing a hyper-local real estate market newsletter for zip code ${zip} (${monthYear}, ${season} market).

${zillowContext}

The newsletter will be sent by ${agentName}${brokerage ? ` of ${brokerage}` : ""} to their sphere of influence contacts. The agent should look like the undisputed local market expert.

Generate a JSON object with these exact fields:
- subject: punchy email subject line under 60 chars (e.g. "The ${zip} Market — ${monthYear} Update")
- marketHeadline: 1 headline sentence describing current market conditions (e.g. "Inventory Stays Tight as Buyer Demand Surges This Spring")
- marketSnapshot: 2-3 sentences describing overall market conditions, trends, price movements — specific to ${zip} and ${season}
- buyerParagraph: 2-3 sentences of advice/insight for buyers in this market right now
- sellerParagraph: 2-3 sentences of advice/insight for sellers in this market right now
- localInsight: 1-2 sentences of a hyper-local nugget (neighborhood feel, school district note, local development, commute pattern, etc.) specific to the zip code area
- ctaText: short CTA sentence (e.g. "Thinking about making a move? Let's talk — a quick call could save you thousands.")
- medianPrice: realistic median home price for this zip (e.g. "$425,000") — generate a plausible number
- priceChange: year-over-year price change (e.g. "+4.2%" or "-1.8%") — plausible for current market
- daysOnMarket: average days on market (e.g. "18 days") — plausible for ${season}
- inventory: months of supply (e.g. "1.4 months") — plausible for ${season}

Be specific, confident, and local. Write like a seasoned agent who eats, breathes, and sleeps this zip code. No generic fluff.

Respond with ONLY valid JSON.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text || "";

  let parsed: NewsletterContent;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || raw);
  } catch {
    // Fallback if JSON parse fails
    parsed = {
      subject: `${zip} Real Estate Update — ${monthYear}`,
      marketHeadline: `The ${zip} Market Stays Active This ${season.charAt(0).toUpperCase() + season.slice(1)}`,
      marketSnapshot: `The ${zip} market continues to show strong fundamentals this ${season}. Buyers remain active and well-qualified listings are moving quickly. Inventory stays lean, keeping upward pressure on prices.`,
      buyerParagraph: `If you're looking to buy in the ${zip} area, getting pre-approved and acting quickly on well-priced homes is essential. The most desirable properties are seeing multiple offers within days of listing.`,
      sellerParagraph: `Sellers in ${zip} are in an excellent position right now. Properly priced and well-presented homes are achieving strong sale prices. If you've been thinking about listing, conditions are favorable.`,
      localInsight: `The ${zip} area continues to attract buyers drawn to its community character and convenient location. Local schools and proximity to amenities remain top priorities for incoming residents.`,
      ctaText: `Thinking about buying or selling in ${zip}? Let's connect — a quick conversation could save you thousands.`,
      medianPrice: "$385,000",
      priceChange: "+3.8%",
      daysOnMarket: "22 days",
      inventory: "1.6 months",
    };
  }

  // Override with real Zillow data if available
  if (zillowData?.medianPrice) parsed.medianPrice = zillowData.medianPrice;
  if (zillowData?.dom) parsed.daysOnMarket = `${zillowData.dom} days`;

  return parsed;
}

function buildNewsletterHtml(
  content: NewsletterContent,
  zip: string,
  agentName: string,
  brokerage: string,
  phone: string,
  website: string,
  brandColor: string,
  monthYear: string
): string {
  const safeColor = brandColor || "#1a4a7a";
  const websiteDisplay = website ? website.replace(/^https?:\/\//, "") : "";
  const agentInitials = agentName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- Header -->
  <tr><td style="background:${safeColor};padding:28px 32px;border-radius:10px 10px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Local Market Report</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;font-family:Georgia,serif;">ZIP ${zip} Market Update</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${monthYear}</p>
        </td>
        <td align="right" valign="middle" style="padding-left:16px;">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-block;text-align:center;line-height:52px;color:#ffffff;font-weight:800;font-size:18px;font-family:Georgia,serif;">${agentInitials}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Agent byline -->
  <tr><td style="background:${safeColor};padding:0 32px 20px;border-bottom:4px solid rgba(255,255,255,0.15);">
    <p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px;">
      Brought to you by <strong style="color:#ffffff;">${agentName}</strong>${brokerage ? ` · ${brokerage}` : ""}
    </p>
  </td></tr>

  <!-- Market Stats Bar -->
  <tr><td style="background:#ffffff;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:20px 8px;border-right:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Median Price</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#1e293b;">${content.medianPrice}</p>
          <p style="margin:2px 0 0;font-size:11px;color:${content.priceChange.startsWith("+") ? "#16a34a" : "#dc2626"};font-weight:600;">${content.priceChange} YoY</p>
        </td>
        <td align="center" style="padding:20px 8px;border-right:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Days on Market</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#1e293b;">${content.daysOnMarket}</p>
        </td>
        <td align="center" style="padding:20px 8px;">
          <p style="margin:0 0 4px;font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Inventory</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#1e293b;">${content.inventory}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#64748b;">supply</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Main Body -->
  <tr><td style="background:#ffffff;padding:28px 32px;border-top:1px solid #e2e8f0;">

    <!-- Market Headline -->
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#1e293b;font-family:Georgia,serif;">${content.marketHeadline}</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.8;">${content.marketSnapshot}</p>

    <!-- Buyer Section -->
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;color:#16a34a;text-transform:uppercase;">For Buyers</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.8;">${content.buyerParagraph}</p>
    </div>

    <!-- Seller Section -->
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:16px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;color:#d97706;text-transform:uppercase;">For Sellers</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.8;">${content.sellerParagraph}</p>
    </div>

    <!-- Local Insight -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:16px 20px;margin:0 0 28px;border-radius:8px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Local Insight</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.8;">${content.localInsight}</p>
    </div>

    <!-- CTA -->
    <div style="background:${safeColor};padding:20px 24px;border-radius:8px;text-align:center;margin:0 0 8px;">
      <p style="margin:0 0 14px;color:#ffffff;font-size:15px;font-weight:600;line-height:1.6;">${content.ctaText}</p>
      ${phone ? `<a href="tel:${phone.replace(/\D/g, "")}" style="display:inline-block;background:#ffffff;color:${safeColor};padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">${phone}</a>` : ""}
    </div>

  </td></tr>

  <!-- Agent Signature -->
  <tr><td style="padding:20px 32px;background:#ffffff;border-top:1px solid #e2e8f0;">
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td valign="middle" style="padding-right:14px;">
          <div style="width:48px;height:48px;border-radius:50%;background:${safeColor};text-align:center;line-height:48px;color:#ffffff;font-weight:800;font-size:16px;">${agentInitials}</div>
        </td>
        <td valign="middle">
          <p style="margin:0;font-size:14px;font-weight:700;color:#1e293b;">${agentName}</p>
          ${brokerage ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${brokerage}</p>` : ""}
          ${phone ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${phone}</p>` : ""}
          ${websiteDisplay ? `<p style="margin:2px 0 0;font-size:12px;"><a href="${website}" style="color:${safeColor};text-decoration:none;">${websiteDisplay}</a></p>` : ""}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;text-align:center;">
      You're receiving this because ${agentName} added you to their market update list.<br>
      Market data is AI-generated based on current trends and may not reflect live MLS data. For accurate valuations, contact ${agentName} directly.<br>
      <a href="mailto:${""}" style="color:#94a3b8;">Unsubscribe</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Fetch all active clients
    const { data: clients, error: clientsError } = await (sb.from as any)("re_newsletter_clients")
      .select("*")
      .eq("subscription_status", "active");

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      console.log("[RE-NEWSLETTER] No active clients found");
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    const monthYear = getMonthYear();
    let totalIssues = 0;
    let totalSent = 0;

    for (const client of clients) {
      const zipList = (client.zip_codes || "")
        .split(/[\n,]+/)
        .map((z: string) => z.trim())
        .filter((z: string) => z.length > 0);

      if (zipList.length === 0) continue;

      // Fetch all contacts for this client
      const { data: contacts } = await (sb.from as any)("re_newsletter_contacts")
        .select("contact_email, contact_name")
        .eq("client_id", client.id);

      if (!contacts || contacts.length === 0) {
        console.log(`[RE-NEWSLETTER] No contacts for client ${client.id} — skipping`);
        continue;
      }

      for (const zip of zipList) {
        try {
          // 1. Try Zillow (will likely fail)
          const zillowData = await tryFetchZillowData(zip);
          if (zillowData) {
            console.log(`[RE-NEWSLETTER] Zillow data for ${zip}: price=${zillowData.medianPrice}, dom=${zillowData.dom}`);
          }

          // 2. Generate content via Claude Haiku
          const content = await generateNewsletterContent(
            zip,
            client.agent_name || client.customer_name || "Your Agent",
            client.brokerage || "",
            zillowData
          );

          // 3. Build HTML
          const html = buildNewsletterHtml(
            content,
            zip,
            client.agent_name || client.customer_name || "Your Agent",
            client.brokerage || "",
            client.phone || "",
            client.website || "",
            client.brand_color || "#1a4a7a",
            monthYear
          );

          // 4. Store the issue
          const { data: issue } = await (sb.from as any)("re_newsletter_issues").insert({
            client_id: client.id,
            zip_code: zip,
            subject: content.subject,
            html_content: html,
            sent_count: contacts.length,
            sent_at: new Date().toISOString(),
          }).select().single();

          // 5. Send to all contacts via Resend
          const batchSize = 50;
          let sentCount = 0;

          for (let i = 0; i < contacts.length; i += batchSize) {
            const batch = contacts.slice(i, i + batchSize);
            await Promise.allSettled(
              batch.map((contact: any) =>
                fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: `${client.agent_name || "Your Agent"} <matt@mattmichelstraining.com>`,
                    to: [contact.contact_email],
                    subject: content.subject,
                    html,
                  }),
                })
              )
            );
            sentCount += batch.length;
          }

          totalSent += sentCount;
          totalIssues++;

          console.log(`[RE-NEWSLETTER] Sent "${content.subject}" to ${sentCount} contacts for client ${client.id} / zip ${zip}`);
        } catch (zipErr) {
          console.error(`[RE-NEWSLETTER] Error processing zip ${zip} for client ${client.id}:`, zipErr);
        }
      }

      // Update last_sent_at on the client record
      await (sb.from as any)("re_newsletter_clients")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", client.id);
    }

    console.log(`[RE-NEWSLETTER] Done — ${totalIssues} issues, ${totalSent} emails sent`);
    return new Response(JSON.stringify({ issues: totalIssues, sent: totalSent }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[RE-NEWSLETTER] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
