// competitor-pricing-scan
// Called weekly (cron). For each active client:
//   1. Fetch each tracked URL, hash first 500 chars, compare to stored hash
//   2. If changed → Claude Haiku extracts what pricing changed
//   3. Store change in competitor_pricing_changes
//   4. Compile weekly report → Claude generates 3 recommendations
//   5. Send styled Resend email

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash: btoa of the first 500 chars of visible text content
function hashContent(text: string): string {
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  try { return btoa(encodeURIComponent(clean)); } catch { return btoa(clean.slice(0, 200)); }
}

// Extract visible text from HTML (naive)
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callClaude(prompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; M2PricingBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function buildReportHtml(opts: {
  companyName: string;
  reportDate: string;
  changes: Array<{ competitor_name: string; change_summary: string; old_snippet: string; new_snippet: string }>;
  recommendations: string;
  noChanges: boolean;
}): string {
  const { companyName, reportDate, changes, recommendations, noChanges } = opts;

  const changesHtml = noChanges
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
        <p style="margin:0;color:#166534;font-size:15px;font-weight:600">No pricing changes detected this week</p>
        <p style="margin:8px 0 0;color:#15803d;font-size:13px">All ${changes.length === 0 ? "tracked" : changes.length} competitor pages are unchanged. Your pricing position is stable.</p>
      </div>`
    : changes.map(ch => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px">
        <div style="background:#2563eb;padding:12px 16px">
          <p style="margin:0;color:#fff;font-weight:700;font-size:14px">${ch.competitor_name}</p>
        </div>
        <div style="padding:16px;background:#fff">
          <p style="margin:0 0 10px;font-size:14px;color:#1e293b"><strong>What changed:</strong> ${ch.change_summary || "Pricing content updated"}</p>
          ${ch.old_snippet ? `<div style="margin-bottom:8px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.08em">Before</p>
            <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:10px 12px;font-size:13px;color:#7f1d1d;font-family:monospace">${ch.old_snippet.slice(0, 300)}</div>
          </div>` : ""}
          ${ch.new_snippet ? `<div>
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:.08em">Now</p>
            <div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:10px 12px;font-size:13px;color:#14532d;font-family:monospace">${ch.new_snippet.slice(0, 300)}</div>
          </div>` : ""}
        </div>
      </div>`).join("");

  const recsLines = recommendations
    .split("\n")
    .filter(l => l.trim())
    .map((l, i) => `<div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="flex-shrink:0;width:28px;height:28px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px">${i + 1}</div>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6">${l.replace(/^\d+[\.\)]\s*/, "")}</p>
    </div>`)
    .slice(0, 3)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <!-- Header -->
  <div style="background:#1e293b;padding:24px 28px;border-bottom:3px solid #2563eb">
    <p style="color:#2563eb;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Development · Competitor Pricing Intelligence</p>
    <h1 style="color:#fff;margin:0;font-size:22px;font-family:Georgia,serif">Weekly Pricing Report</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">${companyName} · ${reportDate}</p>
  </div>
  <!-- Body -->
  <div style="padding:28px;color:#1e293b;font-size:15px;line-height:1.8">
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0">What Changed This Week</h2>
    ${changesHtml}

    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:24px 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0">AI Recommendations</h2>
    ${recsLines || '<p style="color:#64748b;font-size:14px">No new recommendations this week — your pricing strategy looks solid.</p>'}

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">Matt Michels</strong><br>
        Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#2563eb">(313) 806-4952</a>
      </div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:11px">
      <a href="https://www.mattmichelstraining.com/competitor-pricing/dashboard" style="color:#2563eb;text-decoration:none">View Dashboard</a>
    </p>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Support triggering for a single client (new_client) or batch (weekly cron)
    let body: any = {};
    try { body = await req.json(); } catch { /* no body = weekly run */ }
    const { trigger, email: singleEmail } = body;

    // Fetch active clients
    let clientsQuery = sb
      .from("competitor_pricing_clients")
      .select("*")
      .eq("subscription_status", "active");
    if (singleEmail) clientsQuery = clientsQuery.eq("customer_email", singleEmail);

    const { data: clients, error: clientsErr } = await clientsQuery;
    if (clientsErr) throw clientsErr;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const reportDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    for (const client of clients) {
      try {
        // Fetch this client's tracked URLs
        const { data: urls } = await sb
          .from("competitor_pricing_urls")
          .select("*")
          .eq("client_id", client.id);

        if (!urls || urls.length === 0) continue;

        const weeklyChanges: any[] = [];

        for (const trackedUrl of urls) {
          try {
            const html = await fetchPage(trackedUrl.url);
            if (!html) continue;

            const text = extractText(html);
            const newHash = hashContent(text);
            const oldHash = trackedUrl.last_content_hash;

            // Always update the hash and timestamp
            await sb
              .from("competitor_pricing_urls")
              .update({ last_content_hash: newHash, last_scraped_at: new Date().toISOString() })
              .eq("id", trackedUrl.id);

            // Skip diff on first scrape (no prior hash)
            if (!oldHash || oldHash === newHash) continue;

            // Content changed — ask Claude what pricing changed
            const oldSnippet = "Prior version — content hash changed";
            const newSnippet = text.slice(0, 600);

            const diffPrompt = `A competitor's pricing page has changed. Here is the new content (first 600 chars of visible text):

"${newSnippet}"

The previous content was different. Based on this new content, in 1-2 concise sentences describe what appears to have changed about their pricing, packages, or offers. Be specific. If nothing pricing-related is clear, say "General content update detected."`;

            const changeSummary = await callClaude(diffPrompt);

            const recPrompt = `A competitor (${trackedUrl.competitor_name}) changed their pricing page. Summary: "${changeSummary}".

Our company: ${client.company_name || "the client"}. Our pricing notes: ${client.own_pricing_notes || "not provided"}.

In one sentence, give a specific pricing strategy recommendation our company should consider in response to this competitor change.`;

            const aiRecommendation = await callClaude(recPrompt);

            // Store the change
            const { data: change } = await sb
              .from("competitor_pricing_changes")
              .insert({
                client_id: client.id,
                url_id: trackedUrl.id,
                competitor_name: trackedUrl.competitor_name,
                change_summary: changeSummary,
                old_snippet: oldSnippet,
                new_snippet: newSnippet.slice(0, 500),
                ai_recommendation: aiRecommendation,
                included_in_report: false,
              })
              .select()
              .single();

            if (change) weeklyChanges.push(change);
          } catch (urlErr) {
            console.error(`[PRICING-SCAN] Error scanning URL ${trackedUrl.url}:`, urlErr);
          }
        }

        // ── Weekly report ──────────────────────────────────────────────────────
        // Also grab any prior unreported changes
        const { data: unreported } = await sb
          .from("competitor_pricing_changes")
          .select("*")
          .eq("client_id", client.id)
          .eq("included_in_report", false)
          .order("detected_at", { ascending: false })
          .limit(20);

        const allChanges = unreported || [];
        const noChanges = allChanges.length === 0;

        // Generate 3 overall recommendations
        let overallRecs = "";
        if (allChanges.length > 0) {
          const changesContext = allChanges
            .map(c => `- ${c.competitor_name}: ${c.change_summary}`)
            .join("\n");
          const recsPrompt = `We run a competitor pricing intelligence service. Here are this week's detected pricing changes for ${client.company_name || "our client"} in the ${client.industry || "their"} industry:

${changesContext}

Our client's current pricing notes: ${client.own_pricing_notes || "not provided"}

Give exactly 3 numbered, actionable pricing strategy recommendations our client should consider this week. Each recommendation should be 1-2 sentences. Be specific and tactical.`;
          overallRecs = await callClaude(recsPrompt);
        } else {
          overallRecs = "1. Your pricing is stable relative to competitors — maintain current positioning.\n2. Consider a limited-time promotion to capture market share while competitors hold prices steady.\n3. Use this quiet period to audit your value messaging and ensure it clearly differentiates from competitors.";
        }

        // Send the weekly report email
        if (RESEND_API_KEY && client.customer_email) {
          const html = buildReportHtml({
            companyName: client.company_name || client.customer_email,
            reportDate,
            changes: allChanges,
            recommendations: overallRecs,
            noChanges,
          });

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.customer_email],
              bcc: ["matthewmichels4@gmail.com"],
              subject: `📊 Weekly Competitive Pricing Report — ${reportDate}`,
              html,
            }),
          });
        }

        // Mark all included changes as reported
        if (allChanges.length > 0) {
          const changeIds = allChanges.map((c: any) => c.id);
          await sb
            .from("competitor_pricing_changes")
            .update({ included_in_report: true })
            .in("id", changeIds);
        }

        // Update last_report_sent_at
        await sb
          .from("competitor_pricing_clients")
          .update({ last_report_sent_at: new Date().toISOString() })
          .eq("id", client.id);

        processed++;
      } catch (clientErr) {
        console.error(`[PRICING-SCAN] Error processing client ${client.id}:`, clientErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PRICING-SCAN] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
