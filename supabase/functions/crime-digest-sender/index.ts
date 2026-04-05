// Crime Digest Sender — cron weekly Monday 7am ET
// Fetches local crime data via Firecrawl, AI-summarizes it, and emails a branded safety report.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CAN_SPAM_FOOTER = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
    M² Development · Grosse Pointe, MI 48230<br>
    <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
  </div>`;

async function fetchCrimeData(city: string, state: string, zipCode: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + FIRECRAWL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `crime report ${city} ${state} ${zipCode} this week`,
      limit: 10,
    }),
  });

  if (!res.ok) {
    console.error(`[crime-digest-sender] Firecrawl error: ${res.status}`);
    return "";
  }

  const data = await res.json();
  const results: any[] = data?.data || data?.results || [];
  return results
    .map((r: any) => r.markdown || r.content || r.description || "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: clients } = await (sb as any).from("crime_digest_clients").select("*").eq("active", true);
  if (!clients?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: JSON_HEADERS });
  }

  let sent = 0;

  for (const client of clients) {
    try {
      const rawData = await fetchCrimeData(client.city, client.state, client.zip_code);

      const crimeContext = rawData
        ? rawData
        : `No specific crime reports were retrieved for ${client.city}, ${client.state} (${client.zip_code}) this week.`;

      const summary = await generateText(
        `You are a neighborhood safety reporter. Summarize these crime reports for a property manager in ${client.city}, ${client.state} (zip ${client.zip_code}). Group by type (theft, vandalism, assault, etc). Note any trends vs typical activity. Keep it factual and under 300 words. End with 1-2 safety tips.\n\nSource data:\n${crimeContext}`,
        600
      );

      const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const html = `
<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px">
  <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#e8621a;margin:0;font-size:22px">M² Weekly Safety Digest</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${client.city}, ${client.state} ${client.zip_code} · Week of ${weekOf}</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <div style="background:#fff;border-left:3px solid #e8621a;padding:16px 20px;border-radius:0 6px 6px 0;font-size:14px;line-height:1.8;color:#334155;white-space:pre-wrap">${summary}</div>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px">
      Data sourced from publicly available local news and police reports. Always verify with official sources.
    </p>
    ${CAN_SPAM_FOOTER}
  </div>
</div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Safety Reports <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `Weekly Crime Digest — ${client.city}, ${client.state} · ${weekOf}`,
          html,
        }),
      });

      sent++;
    } catch (e) {
      console.error(`[crime-digest-sender] Error for ${client.email}:`, e);
    }
  }

  console.log(`[crime-digest-sender] Sent ${sent} digests`);
  return new Response(JSON.stringify({ sent }), { status: 200, headers: JSON_HEADERS });
});
