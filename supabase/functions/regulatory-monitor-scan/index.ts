// regulatory-monitor-scan
// Called by cron every Monday at 7am ET and fire-and-forget on new client signup.
// For each active client: fetch Federal Register API → Claude haiku summarizes →
// insert new items → send navy/gold digest email via Resend → update last_sent_at.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// ── Industry → Federal Register search terms ──────────────────────────────
const INDUSTRY_TERMS: Record<string, string> = {
  healthcare:     "medicare medicaid FDA drug medical device hospital",
  finance:        "SEC FINRA banking CFPB securities investment",
  cannabis:       "cannabis marijuana hemp CBD controlled substance",
  food_bev:       "FDA food safety USDA nutrition labeling restaurant",
  construction:   "OSHA safety building EPA construction contractor",
  real_estate:    "HUD fair housing mortgage CFPB rental property",
  hr_employment:  "NLRB DOL wage overtime EEOC employment discrimination",
};

const INDUSTRY_LABELS: Record<string, string> = {
  healthcare:    "Healthcare",
  finance:       "Finance & Banking",
  cannabis:      "Cannabis",
  food_bev:      "Food & Beverage",
  construction:  "Construction",
  real_estate:   "Real Estate",
  hr_employment: "HR & Employment",
};

// ── Fetch Federal Register documents ─────────────────────────────────────
async function fetchFederalRegister(industry: string, subIndustries: string, stateFocus: string): Promise<any[]> {
  const baseTerms = INDUSTRY_TERMS[industry] || industry;
  const extraTerms = subIndustries ? ` ${subIndustries}` : "";
  const term = encodeURIComponent((baseTerms + extraTerms).trim());

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const url =
    `https://www.federalregister.gov/api/v1/documents.json` +
    `?fields[]=title&fields[]=abstract&fields[]=html_url&fields[]=publication_date&fields[]=agencies` +
    `&per_page=20&order=newest` +
    `&conditions[publication_date][gte]=${sevenDaysAgo}` +
    `&conditions[term]=${term}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "M2Development-RegulatoryMonitor/1.0" } });
    if (!res.ok) {
      console.error(`[REG-SCAN] Federal Register API error ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("[REG-SCAN] Fetch error:", e);
    return [];
  }
}

// ── Claude haiku summarization ────────────────────────────────────────────
interface SummaryResult {
  summary: string;
  impact_level: "high" | "medium" | "low";
  action: string;
}

async function summarizeWithClaude(title: string, abstract: string, industry: string): Promise<SummaryResult> {
  if (!LOVABLE_API_KEY) {
    return {
      summary: abstract?.slice(0, 300) || title,
      impact_level: "medium",
      action: "Review this regulatory change and consult your compliance team.",
    };
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4",
        messages: [
          {
            role: "user",
            content: `You are a regulatory compliance analyst. Summarize this Federal Register document in plain business English for a ${INDUSTRY_LABELS[industry] || industry} business owner.

Title: ${title}
Abstract: ${abstract || "(no abstract)"}

Respond with JSON only (no markdown):
{
  "summary": "2-3 sentence plain-English explanation of what changed and why it matters",
  "impact_level": "high" | "medium" | "low",
  "action": "one specific action the business owner should take within 30 days"
}

impact_level guide:
- high = immediate compliance deadline, significant penalty risk, or major operational change required
- medium = review required, moderate changes needed, 30-90 day window
- low = informational, no immediate action required`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || title,
        impact_level: ["high", "medium", "low"].includes(parsed.impact_level) ? parsed.impact_level : "medium",
        action: parsed.action || "Review and consult your compliance team.",
      };
    }
  } catch (e) {
    console.error("[REG-SCAN] Claude summarization error:", e);
  }

  return {
    summary: abstract?.slice(0, 300) || title,
    impact_level: "medium",
    action: "Review this regulatory change with your compliance team.",
  };
}

// ── Build digest email HTML ────────────────────────────────────────────────
function buildDigestEmail(opts: {
  companyName: string;
  industry: string;
  dateStr: string;
  items: Array<{
    title: string;
    agency: string;
    published_date: string;
    summary: string;
    impact_level: string;
    action: string;
    source_url: string;
  }>;
}): string {
  const { companyName, industry, dateStr, items } = opts;

  const impactColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
    high:   { bg: "#fff5f5", border: "#feb2b2", badge: "#e53e3e", text: "HIGH IMPACT" },
    medium: { bg: "#fffbeb", border: "#f6d860", badge: "#d69e2e", text: "MEDIUM IMPACT" },
    low:    { bg: "#f0fff4", border: "#9ae6b4", badge: "#38a169", text: "LOW IMPACT" },
  };

  const grouped: Record<string, typeof items> = { high: [], medium: [], low: [] };
  for (const item of items) {
    const lvl = item.impact_level as "high" | "medium" | "low";
    if (grouped[lvl]) grouped[lvl].push(item);
  }

  let itemsHtml = "";

  for (const level of ["high", "medium", "low"] as const) {
    if (grouped[level].length === 0) continue;
    const c = impactColors[level];
    itemsHtml += `
      <tr><td style="padding:20px 28px 8px">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:${c.badge};text-transform:uppercase">
          ${c.text} — ${grouped[level].length} item${grouped[level].length > 1 ? "s" : ""}
        </p>
      </td></tr>`;

    for (const item of grouped[level]) {
      const agencyNames = item.agency || "Federal Agency";
      itemsHtml += `
        <tr><td style="padding:4px 28px 16px">
          <div style="background:${c.bg};border:1px solid ${c.border};border-left:4px solid ${c.badge};border-radius:4px;padding:16px 18px">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1a2744;line-height:1.4">
              <a href="${item.source_url}" style="color:#1a2744;text-decoration:none">${item.title}</a>
            </p>
            <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">
              ${agencyNames} &nbsp;·&nbsp; Published ${item.published_date}
            </p>
            <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.7">${item.summary}</p>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px">
              <p style="margin:0;font-size:12px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:1px">Recommended Action</p>
              <p style="margin:4px 0 0;font-size:13px;color:#475569">${item.action}</p>
            </div>
            <p style="margin:8px 0 0">
              <a href="${item.source_url}" style="font-size:12px;color:#c9a227;text-decoration:none;font-weight:600">
                Read Full Text on Federal Register →
              </a>
            </p>
          </div>
        </td></tr>`;
    }
  }

  const totalItems = items.length;
  const highCount = grouped.high.length;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
<tr><td align="center" style="padding:24px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px">

  <!-- Header -->
  <tr><td style="background:#1a2744;padding:24px 28px;border-radius:10px 10px 0 0">
    <p style="margin:0 0 2px;color:#c9a227;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase">M² Development</p>
    <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-family:Georgia,serif">AI Regulatory Change Monitor</h1>
    <p style="margin:0;color:#94a3b8;font-size:13px">${INDUSTRY_LABELS[industry] || industry} · Week of ${dateStr}</p>
  </td></tr>

  <!-- Summary bar -->
  <tr><td style="background:#c9a227;padding:12px 28px">
    <p style="margin:0;color:#1a2744;font-size:13px;font-weight:700">
      ${totalItems} new regulation${totalItems !== 1 ? "s" : ""} this week${highCount > 0 ? ` · ${highCount} HIGH IMPACT` : ""} · Compiled for ${companyName}
    </p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:0;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${itemsHtml}
      <tr><td style="padding:20px 28px 24px">
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px">
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.7">
          This digest covers the past 7 days of Federal Register activity relevant to <strong>${INDUSTRY_LABELS[industry] || industry}</strong>.
          Always consult a qualified compliance attorney before making regulatory decisions.
        </p>
        <p style="margin:0;font-size:13px;color:#64748b">
          Questions? Reply to this email or text Matt at
          <a href="tel:+13138064952" style="color:#c9a227">(313) 806-4952</a>.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:16px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:44px;height:44px;border-radius:50%;object-fit:cover">
      <div style="font-size:13px;color:#475569">
        <strong style="color:#1a2744">Matt Michels</strong><br>
        Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#c9a227">(313) 806-4952</a>
      </div>
      <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain">
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1a2744;padding:14px 28px;border-radius:0 0 10px 10px;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">
      M² Development · mattmichelstraining.com · AI Regulatory Change Monitor ($197/mo)
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json")
      ? await req.json().catch(() => ({}))
      : {};

    const triggerEmail: string | null = body?.email || null;
    const isSingleClient = !!triggerEmail;

    // Fetch clients
    let query = (sb.from as any)("regulatory_monitor_clients")
      .select("*")
      .eq("subscription_status", "active");

    if (isSingleClient) {
      query = query.eq("customer_email", triggerEmail);
    }

    const { data: clients, error: clientErr } = await query;

    if (clientErr) {
      console.error("[REG-SCAN] DB error:", clientErr);
      return new Response(JSON.stringify({ error: clientErr.message }), { status: 500 });
    }

    if (!clients || clients.length === 0) {
      console.log("[REG-SCAN] No active clients found");
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;
    let emailsSent = 0;

    for (const client of clients) {
      try {
        console.log(`[REG-SCAN] Processing client: ${client.customer_email} (${client.industry})`);

        // Fetch Federal Register docs
        const docs = await fetchFederalRegister(
          client.industry,
          client.sub_industries || "",
          client.state_focus || "",
        );

        if (docs.length === 0) {
          console.log(`[REG-SCAN] No new docs for ${client.customer_email}`);
          processed++;
          continue;
        }

        // Summarize each doc and upsert into regulatory_monitor_items
        const newItems: Array<{
          title: string;
          agency: string;
          published_date: string;
          summary: string;
          impact_level: string;
          action: string;
          source_url: string;
        }> = [];

        for (const doc of docs) {
          const sourceUrl = doc.html_url || "";
          if (!sourceUrl) continue;

          // Check if already exists
          const { data: existing } = await (sb.from as any)("regulatory_monitor_items")
            .select("id")
            .eq("client_id", client.id)
            .eq("source_url", sourceUrl)
            .maybeSingle();

          if (existing) continue;

          const agencyNames = (doc.agencies || [])
            .map((a: any) => a.name || a.raw_name || "")
            .filter(Boolean)
            .join(", ");

          const { summary, impact_level, action } = await summarizeWithClaude(
            doc.title || "Regulatory Update",
            doc.abstract || "",
            client.industry,
          );

          const insertData = {
            client_id: client.id,
            source_url: sourceUrl,
            title: doc.title || "Regulatory Update",
            agency: agencyNames,
            published_date: doc.publication_date || null,
            summary,
            impact_level,
            sent_to_client: false,
          };

          const { error: insertErr } = await (sb.from as any)("regulatory_monitor_items").insert(insertData);

          if (!insertErr) {
            newItems.push({ ...insertData, action });
          } else if (!insertErr.message?.includes("unique")) {
            console.error("[REG-SCAN] Insert error:", insertErr.message);
          }
        }

        processed++;

        // Send digest if there are new items and Resend is configured
        if (newItems.length > 0 && RESEND_API_KEY) {
          const dateStr = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          const industryLabel = INDUSTRY_LABELS[client.industry] || client.industry;
          const html = buildDigestEmail({
            companyName: client.company_name || client.customer_name || client.customer_email,
            industry: client.industry,
            dateStr,
            items: newItems,
          });

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.customer_email],
              bcc: ["matthewmichels4@gmail.com"],
              subject: `📋 Weekly Regulatory Update — ${industryLabel} — ${dateStr}`,
              html,
            }),
          });

          // Mark items as sent
          await (sb.from as any)("regulatory_monitor_items")
            .update({ sent_to_client: true })
            .eq("client_id", client.id)
            .eq("sent_to_client", false);

          // Update last_sent_at
          await (sb.from as any)("regulatory_monitor_clients")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", client.id);

          emailsSent++;
          console.log(`[REG-SCAN] Digest sent to ${client.customer_email} — ${newItems.length} items`);
        }
      } catch (clientErr) {
        console.error(`[REG-SCAN] Error processing client ${client.customer_email}:`, clientErr);
      }
    }

    return new Response(
      JSON.stringify({ processed, emails_sent: emailsSent }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[REG-SCAN] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
