// enrichment-cost-rollup
// Daily KPI rollup. READ-ONLY against working tables; writes only to daily_metrics.
// Triggers SMS alert if cost-per-contactable-lead doubles week-over-week.
//
// Cron: daily 11am UTC (after staleness cleanup runs).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function smsMatt(body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_FROM, Body: body }).toString(),
    });
  } catch { /* ignore */ }
}

async function upsertMetric(date: string, name: string, value: number, metadata: Record<string, unknown> = {}) {
  await (sb.from as any)("daily_metrics").upsert(
    { metric_date: date, metric_name: name, metric_value: value, metadata },
    { onConflict: "metric_date,metric_name" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    // 1. Daily AI spend (sum of cost_usd in ai_call_log over last 24h)
    const { data: aiRows } = await sb
      .from("ai_call_log")
      .select("cost_usd, provider, model")
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString());

    const totalAiCost = (aiRows || []).reduce(
      (s: number, r: any) => s + (Number(r.cost_usd) || 0),
      0,
    );
    const aiCallCount = (aiRows || []).length;

    await upsertMetric(today, "ai_cost_usd_24h", totalAiCost, { call_count: aiCallCount });

    // 2. Contactable candidates added in last 24h (have phone OR email + score>=5)
    const { count: contactableCount } = await sb
      .from("hire_alert_candidates")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString())
      .or("phone.not.is.null,email.not.is.null")
      .gte("score", 5);

    const contactable = contactableCount || 0;
    await upsertMetric(today, "contactable_candidates_24h", contactable);

    // 3. Cost per contactable lead
    const costPerLead = contactable > 0 ? totalAiCost / contactable : 0;
    await upsertMetric(today, "cost_per_contactable_lead", costPerLead);

    // 4. Week-over-week comparison: alert if today's CPL > 2× last week's average
    const { data: weekRows } = await sb
      .from("daily_metrics")
      .select("metric_value")
      .eq("metric_name", "cost_per_contactable_lead")
      .gte("metric_date", weekAgo.slice(0, 10))
      .lt("metric_date", today);

    const weekAvg =
      weekRows && weekRows.length > 0
        ? weekRows.reduce((s: number, r: any) => s + Number(r.metric_value || 0), 0) / weekRows.length
        : 0;

    let alertSent = false;
    if (weekAvg > 0 && costPerLead > weekAvg * 2 && costPerLead > 0.05) {
      await smsMatt(
        `📈 Enrichment cost spike: $${costPerLead.toFixed(3)}/lead today vs $${weekAvg.toFixed(3)}/lead 7d avg. ${contactable} leads, $${totalAiCost.toFixed(2)} spend.`,
      );
      alertSent = true;
    }

    // 5. Per-provider breakdown for the day (informational)
    const byProvider: Record<string, number> = {};
    for (const r of aiRows || []) {
      const p = (r as any).provider || "unknown";
      byProvider[p] = (byProvider[p] || 0) + (Number((r as any).cost_usd) || 0);
    }
    for (const [provider, cost] of Object.entries(byProvider)) {
      await upsertMetric(today, `ai_cost_by_provider_${provider}`, cost);
    }

    // 6. Cache hit rate (informational — quality signal for #13)
    const { data: cacheRows } = await sb
      .from("llm_response_cache")
      .select("hit_count")
      .gte("last_hit_at", new Date(Date.now() - 86400_000).toISOString());
    const cacheHits = (cacheRows || []).reduce(
      (s: number, r: any) => s + Math.max(0, (r.hit_count || 1) - 1),
      0,
    );
    await upsertMetric(today, "llm_cache_hits_24h", cacheHits);

    return new Response(
      JSON.stringify({
        ok: true,
        date: today,
        cost_per_contactable_lead: costPerLead,
        ai_cost_24h: totalAiCost,
        contactable_candidates_24h: contactable,
        ai_call_count: aiCallCount,
        week_avg_cpl: weekAvg,
        alert_sent: alertSent,
        by_provider: byProvider,
        cache_hits_24h: cacheHits,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
