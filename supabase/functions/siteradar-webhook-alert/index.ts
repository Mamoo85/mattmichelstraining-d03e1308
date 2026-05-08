// SiteRadar Webhook Alert — POSTs hot visitors to a customer's webhook
// (Slack/Teams/Discord/Zapier/Make/n8n). Fires when a HOT visitor (score >= threshold)
// is identified. Triggered by the dashboard or by post-enrichment hooks.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { client_id, company_name, score, city, pages } = await req.json();
    if (!client_id || !company_name) {
      return new Response(JSON.stringify({ error: "client_id + company_name required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("alert_webhook_url, alert_webhook_min_score, business_name")
      .eq("id", client_id)
      .maybeSingle();
    if (!client?.alert_webhook_url) {
      return new Response(JSON.stringify({ skipped: "no_webhook" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const minScore = client.alert_webhook_min_score ?? 70;
    if ((score ?? 0) < minScore) {
      return new Response(JSON.stringify({ skipped: "below_threshold", minScore }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const text = `🔥 ${company_name}${city ? " (" + city + ")" : ""} just visited ${client.business_name} — intent ${score}/100`;
    // Slack/Discord/Teams shape: {text, attachments}; Zapier/Make/n8n accept any JSON.
    const payload = {
      text,
      company_name,
      score,
      city,
      pages,
      visited_at: new Date().toISOString(),
      attachments: [{
        color: "#00d4ff",
        title: company_name,
        fields: [
          { title: "Intent score", value: String(score), short: true },
          { title: "City", value: city || "—", short: true },
          { title: "Pages", value: (pages || []).slice(0, 5).join("\n") || "—" },
        ],
      }],
    };
    const r = await fetch(client.alert_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return new Response(JSON.stringify({ ok: r.ok, status: r.status }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
