import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
    const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(JSON.stringify({ error: "DataForSEO credentials not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

    // Get SEO Guard clients with competitor URLs
    const { data: clients } = await supabase.from("seo_guard_clients").select("*").eq("active", true);
    if (!clients?.length) {
      return new Response(JSON.stringify({ message: "No active clients to check" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let alertsSent = 0;

    for (const client of clients) {
      const keywords = client.tracked_keywords || [];
      const competitors = client.competitor_urls || [];
      if (!keywords.length || !competitors.length) continue;

      for (const keyword of keywords.slice(0, 5)) {
        try {
          const serpRes = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
            body: JSON.stringify([{ keyword, location_code: 1023191, language_code: "en", depth: 20 }]),
          });
          const serpData = await serpRes.json();
          const items = serpData?.tasks?.[0]?.result?.[0]?.items || [];

          const clientDomain = (client.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
          const clientItem = items.find((i: any) => i.domain?.includes(clientDomain));
          const clientPos = clientItem?.rank_absolute || 999;

          for (const compUrl of competitors) {
            const compDomain = compUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
            const compItem = items.find((i: any) => i.domain?.includes(compDomain));
            if (!compItem) continue;
            const compPos = compItem.rank_absolute;

            if (compPos < clientPos) {
              // Competitor is outranking — log and alert
              await supabase.from("competitor_threat_log").insert({
                client_id: client.id,
                keyword,
                competitor: compDomain,
                client_position: clientPos,
                competitor_position: compPos,
              });

              // Send alert email
              if (RESEND_API_KEY && client.email) {
                const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
                await fetch(`${GATEWAY_URL}/emails`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "X-Connection-Api-Key": RESEND_API_KEY,
                  },
                  body: JSON.stringify({
                    from: "Detroit Web Agency <matt@detroitwebagent.com>",
                    to: [client.email],
                    subject: `⚠ Competitor Alert: "${keyword}" — You've Been Outranked`,
                    html: `<h2>Competitor Threat Detected</h2>
                      <p><strong>${compDomain}</strong> is now ranking <strong>#${compPos}</strong> for "<strong>${keyword}</strong>" — while you're at <strong>#${clientPos}</strong>.</p>
                      <p>This means they're getting the calls and leads that should be yours.</p>
                      <h3>Fix This Now</h3>
                      <p><a href="https://www.detroitwebagent.com/seo-guard">Upgrade to SEO Sprint →</a></p>
                      <p>— Matt Michels, Lead Web Agent<br/>Detroit Web Agency | (313) 992-1219</p>`,
                  }),
                });
                alertsSent++;
              }
            }
          }
        } catch (e) {
          console.error(`SERP check failed for keyword "${keyword}":`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, alertsSent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("competitor-threat-alerts error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
