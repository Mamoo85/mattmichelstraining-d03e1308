import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Permit {
  address?: string;
  permit_type?: string;
  estimated_value?: string;
  contractor_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch active permit watch clients
    const { data: clients, error: clientErr } = await (sb as any)
      .from("permit_watch_clients")
      .select("id, email, name, city, state, trades")
      .eq("active", true);

    if (clientErr) {
      console.error("[permit-watch-scanner] Client query error:", clientErr.message);
      return new Response(JSON.stringify({ error: clientErr.message }), {
        status: 500,
        headers: { ...JSON_HEADERS, ...CORS_HEADERS },
      });
    }

    const activeClients: any[] = clients || [];
    console.log(`[permit-watch-scanner] Processing ${activeClients.length} clients`);

    let emailsSent = 0;

    for (const client of activeClients) {
      const city: string = client.city || "";
      const state: string = client.state || "";
      const trades: string[] = client.trades || [];

      if (!city || !state) continue;

      // Search for permits via Firecrawl
      const firecrawlRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `new building permits filed ${city} ${state} this week`,
          limit: 10,
        }),
      });

      if (!firecrawlRes.ok) {
        console.warn(`[permit-watch-scanner] Firecrawl error for ${client.id}: ${firecrawlRes.status}`);
        continue;
      }

      const firecrawlData = await firecrawlRes.json();
      const rawText = (firecrawlData.data || firecrawlData.results || [])
        .map((r: any) => r.markdown || r.content || r.text || "")
        .join("\n\n");

      if (!rawText.trim()) {
        console.log(`[permit-watch-scanner] No permit text found for client ${client.id}`);
        continue;
      }

      // AI extracts structured permit data
      const aiResponse = await generateText(
        `Extract building permits from this text. For each permit, give: address, permit_type, estimated_value, contractor_name. Return as JSON array.\n\n${rawText}`,
        1200
      );

      let permits: Permit[] = [];
      try {
        const match = aiResponse.match(/\[[\s\S]*\]/);
        if (match) permits = JSON.parse(match[0]);
      } catch {
        console.warn(`[permit-watch-scanner] Failed to parse permits JSON for client ${client.id}`);
        continue;
      }

      if (permits.length === 0) continue;

      // Match permits to client's trades
      const matchedPermits = permits.filter((p) => {
        if (trades.length === 0) return true;
        const permitType = (p.permit_type || "").toLowerCase();
        return trades.some((trade) => permitType.includes(trade.toLowerCase()));
      });

      if (matchedPermits.length === 0) {
        console.log(`[permit-watch-scanner] No trade-matching permits for client ${client.id}`);
        continue;
      }

      // Build email HTML
      const permitRows = matchedPermits
        .map(
          (p) => `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px;font-size:13px;color:#334155;">${p.address || "—"}</td>
          <td style="padding:10px 8px;font-size:13px;color:#334155;">${p.permit_type || "—"}</td>
          <td style="padding:10px 8px;font-size:13px;color:#334155;">${p.estimated_value || "—"}</td>
          <td style="padding:10px 8px;font-size:13px;color:#334155;">${p.contractor_name || "—"}</td>
        </tr>`
        )
        .join("");

      const html = `
        <div style="font-family:sans-serif;max-width:650px;margin:0 auto;">
          <div style="background:#e8621a;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:22px;">M² Permit Watch</h1>
            <p style="color:#fde8d8;margin:4px 0 0;font-size:14px;">${matchedPermits.length} new permit${matchedPermits.length !== 1 ? "s" : ""} in ${city}, ${state}</p>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#334155;margin:0 0 20px;">Hi ${client.name || "there"}, here are the latest building permits matching your trades in ${city}, ${state}:</p>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Address</th>
                  <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Permit Type</th>
                  <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Est. Value</th>
                  <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;">Contractor</th>
                </tr>
              </thead>
              <tbody>${permitRows}</tbody>
            </table>
          </div>
          <div style="background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#94a3b8;text-align:center;">
            M² Development · Grosse Pointe, MI 48230<br>
            You're receiving this because you subscribed to M² Permit Watch.
          </div>
        </div>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "M² Permits <matt@mattmichelstraining.com>",
          to: client.email,
          subject: `🏗️ ${matchedPermits.length} New Permit${matchedPermits.length !== 1 ? "s" : ""} in ${city}, ${state}`,
          html,
        }),
      });

      if (emailRes.ok) {
        emailsSent++;

        // Update last_report_at on client record
        await (sb as any)
          .from("permit_watch_clients")
          .update({ last_report_at: new Date().toISOString() })
          .eq("id", client.id);
      } else {
        const err = await emailRes.text();
        console.error(`[permit-watch-scanner] Resend error for ${client.email}: ${err}`);
      }
    }

    console.log(`[permit-watch-scanner] Done — ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({ clientsProcessed: activeClients.length, emailsSent }),
      { headers: { ...JSON_HEADERS, ...CORS_HEADERS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[permit-watch-scanner] Exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...JSON_HEADERS, ...CORS_HEADERS },
    });
  }
});
