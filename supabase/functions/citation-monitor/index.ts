// citation-monitor — cron every Monday 9am ET (0 14 * * 1)
// Checks Yelp, Facebook, Google Places for NAP consistency,
// emails weekly citation health report to each client.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function firecrawlSearch(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 3 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = data.data || [];
    return results
      .map((r: { title?: string; url?: string; markdown?: string }) =>
        `SOURCE: ${r.title || r.url || ""}\nURL: ${r.url || ""}\n${(r.markdown || "").slice(0, 800)}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

async function googlePlacesSearch(businessName: string, address: string): Promise<string> {
  try {
    const query = encodeURIComponent(`${businessName} ${address}`);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=name,formatted_address,formatted_phone_number,place_id&key=${GOOGLE_MAPS_API_KEY}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const place = data.candidates?.[0];
    if (!place) return "No Google Places listing found.";
    return `Google Places:\nName: ${place.name || "N/A"}\nAddress: ${place.formatted_address || "N/A"}\nPhone: ${place.formatted_phone_number || "N/A"}`;
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const weekOf = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
  const results: string[] = [];

  try {
    const { data: clients, error } = await sb
      .from("citation_monitor_clients")
      .select("*")
      .eq("active", true);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ message: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const client of clients) {
      try {
        const businessName: string = client.business_name || client.name;
        const businessAddress: string = client.address || "";
        const businessPhone: string = client.phone || "";

        // Search Yelp
        const yelpData = await firecrawlSearch(`site:yelp.com "${businessName}"`);
        // Search Facebook
        const facebookData = await firecrawlSearch(`site:facebook.com "${businessName}"`);
        // Google Places API
        const googleData = await googlePlacesSearch(businessName, businessAddress);

        const prompt = `You are a local SEO specialist analyzing business citation consistency (NAP = Name, Address, Phone).

BUSINESS INFORMATION (what is correct):
Business Name: ${businessName}
Address: ${businessAddress}
Phone: ${businessPhone}
Email: ${client.email}

YELP LISTING DATA:
${yelpData || "No Yelp listing found."}

FACEBOOK LISTING DATA:
${facebookData || "No Facebook listing found."}

GOOGLE PLACES DATA:
${googleData || "No Google Places data found."}

Analyze the NAP consistency across all sources found. Generate a weekly citation health report.

FORMAT AS JSON:
{
  "napAnalysis": [
    {
      "source": "Yelp",
      "nameFound": "Exact name as found",
      "addressFound": "Address as found",
      "phoneFound": "Phone as found",
      "nameMatch": true/false,
      "addressMatch": true/false,
      "phoneMatch": true/false,
      "listingUrl": "URL if found",
      "issues": ["list of specific discrepancies"]
    }
  ],
  "inconsistenciesCount": 0,
  "overallHealth": "excellent/good/fair/poor",
  "seoImpact": "2-3 sentences explaining the SEO impact of what was found",
  "priorityFixes": [
    { "priority": 1, "source": "Yelp", "issue": "Phone number wrong", "howToFix": "Log in to Yelp and update..." }
  ],
  "reportHtml": "Full HTML weekly citation health report with color-coded status indicators and priority fix list"
}`;

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1200,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const aiJson = await aiRes.json();
        const rawText = aiJson.content?.[0]?.text || "{}";

        let parsed: {
          napAnalysis?: Array<{
            source: string;
            nameFound?: string;
            addressFound?: string;
            phoneFound?: string;
            nameMatch?: boolean;
            addressMatch?: boolean;
            phoneMatch?: boolean;
            listingUrl?: string;
            issues?: string[];
          }>;
          inconsistenciesCount?: number;
          overallHealth?: string;
          seoImpact?: string;
          priorityFixes?: Array<{ priority: number; source: string; issue: string; howToFix: string }>;
          reportHtml?: string;
        } = {};
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { reportHtml: rawText };
        }

        const healthColors: Record<string, string> = {
          excellent: "#16a34a",
          good: "#65a30d",
          fair: "#d97706",
          poor: "#dc2626",
        };
        const health = parsed.overallHealth || "fair";
        const healthColor = healthColors[health] || "#64748b";

        const napTableRows = (parsed.napAnalysis || [])
          .map(
            (n) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${n.source}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${n.nameFound || "Not found"} ${n.nameMatch === false ? "⚠️" : n.nameMatch === true ? "✅" : ""}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${n.addressFound || "Not found"} ${n.addressMatch === false ? "⚠️" : n.addressMatch === true ? "✅" : ""}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${n.phoneFound || "Not found"} ${n.phoneMatch === false ? "⚠️" : n.phoneMatch === true ? "✅" : ""}</td>
          </tr>`
          )
          .join("");

        const fixesHtml = (parsed.priorityFixes || [])
          .map(
            (f) => `
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
            <div style="font-weight:bold;color:#dc2626;">#${f.priority} Priority — ${f.source}</div>
            <div style="margin:4px 0;"><strong>Issue:</strong> ${f.issue}</div>
            <div style="color:#475569;font-size:14px;"><strong>How to fix:</strong> ${f.howToFix}</div>
          </div>`
          )
          .join("");

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;border-bottom:2px solid #e8621a;padding-bottom:8px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;}
  th{background:#1e293b;color:#fff;padding:10px;text-align:left;font-size:13px;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Citation Health Report</h1>
<p style="color:#64748b;">Week of ${weekOf} | ${businessName}</p>

<div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
  <div style="font-size:14px;color:#64748b;margin-bottom:4px;">Overall Citation Health</div>
  <div style="font-size:32px;font-weight:bold;color:${healthColor};">${health.toUpperCase()}</div>
  <div style="font-size:14px;color:#475569;margin-top:8px;">${parsed.inconsistenciesCount || 0} inconsistencies found across ${(parsed.napAnalysis || []).length} platforms</div>
</div>

<h2>NAP Consistency Check</h2>
<table>
  <thead><tr><th>Platform</th><th>Business Name</th><th>Address</th><th>Phone</th></tr></thead>
  <tbody>${napTableRows}</tbody>
</table>

<div style="background:#fff8f0;border-left:4px solid #e8621a;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
  <strong>SEO Impact:</strong><br>${parsed.seoImpact || ""}
</div>

${fixesHtml ? `<h2>Priority Fixes</h2>${fixesHtml}` : "<p style='color:#16a34a;font-weight:bold;'>✅ No fixes needed — your citations look great!</p>"}

${parsed.reportHtml || ""}

<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M² Performance Training | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [client.email],
            subject: `📍 Citation Health Report — ${health.toUpperCase()} — Week of ${weekOf}`,
            html: emailHtml,
          }),
        });

        await sb
          .from("citation_monitor_clients")
          .update({ last_scan_at: new Date().toISOString() })
          .eq("id", client.id);

        results.push(`✓ ${client.email} — health: ${health}, issues: ${parsed.inconsistenciesCount || 0}`);
      } catch (clientErr) {
        results.push(`✗ ${client.email} — ${clientErr}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("citation-monitor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
