// growth-radar-slack-push — GR-13
// Pushes new Growth Radar signals to a client's Slack/Teams webhook.
// Cron: every hour. Looks for signals from last 60 min, dispatches to subscribed clients.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const testWebhook: string | undefined = body?.test_webhook;

    if (testWebhook) {
      const r = await fetch(testWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ Growth Radar test ping — webhook is wired up." }),
      });
      return new Response(JSON.stringify({ ok: r.ok, status: r.status }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Find clients with webhooks configured
    const { data: clients } = await sb
      .from("growth_radar_clients")
      .select("id, business_name, slack_webhook_url, teams_webhook_url, territory_counties")
      .eq("active", true);

    const subscribed = (clients || []).filter(
      (c: any) => c.slack_webhook_url || c.teams_webhook_url
    );

    if (subscribed.length === 0) {
      return new Response(JSON.stringify({ pushed: 0, reason: "no webhooks configured" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sixtyMin = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: signals } = await sb
      .from("growth_radar_signals")
      .select("id, company_name, signal_type, summary, county, confidence")
      .gte("created_at", sixtyMin)
      .gte("confidence", 7)
      .limit(20);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ pushed: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let pushed = 0;
    for (const client of subscribed) {
      const territory: string[] = client.territory_counties || [];
      const matched = signals.filter(
        (s: any) => territory.length === 0 || territory.includes(s.county)
      );
      if (matched.length === 0) continue;

      const lines = matched.slice(0, 5).map((s: any) =>
        `• *${s.company_name}* — ${s.summary} _(${s.county || "MI"}, conf ${s.confidence}/10)_`
      ).join("\n");

      const payload = {
        text: `🛰️ *Growth Radar* — ${matched.length} new signal(s):\n${lines}`,
      };

      const url = client.slack_webhook_url || client.teams_webhook_url;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8_000),
        });
        if (r.ok) pushed++;
      } catch (e) {
        console.error(`[slack-push] ${client.business_name} failed:`, e);
      }
    }

    return new Response(JSON.stringify({ pushed, signals: signals.length, clients: subscribed.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[growth-radar-slack-push]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
