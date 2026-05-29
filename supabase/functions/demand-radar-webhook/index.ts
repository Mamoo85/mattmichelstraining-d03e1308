import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Zapier-compatible webhook endpoint for Demand Radar signals.
 * When new high-confidence signals are detected, fire webhook to
 * subscriber's configured URL (Zapier, Make, custom CRM).
 *
 * Triggered after industry-pulse-scanner runs.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get new signals
    const { data: signals } = await supabase
      .from("industry_pulse_signals")
      .select("*")
      .gte("detected_at", since)
      .gte("confidence", 5)
      .order("confidence", { ascending: false })
      .limit(20);

    if (!signals?.length) {
      return new Response(JSON.stringify({ fired: 0, reason: "No new signals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscribers with webhook URLs configured
    const { data: subscribers } = await supabase
      .from("industry_pulse_clients")
      .select("id, email, company_name, webhook_url, target_industries")
      .eq("active", true)
      .not("webhook_url", "is", null);

    if (!subscribers?.length) {
      return new Response(JSON.stringify({ fired: 0, reason: "No webhook subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fired = 0;
    const results: { subscriber: string; status: number | string }[] = [];

    for (const sub of subscribers) {
      // Filter signals by industry
      const targetInds: string[] = sub.target_industries || [];
      const relevant = targetInds.length > 0 && !targetInds.includes("all")
        ? signals.filter((s: any) => targetInds.some((t: string) => (s.industry || "").toLowerCase().includes(t.toLowerCase())))
        : signals;

      if (!relevant.length) continue;

      // Fire webhook with signal data
      try {
        const payload = {
          event: "new_demand_signals",
          subscriber: { id: sub.id, company: sub.company_name },
          signals: relevant.map((s: any) => ({
            company_name: s.company_name,
            location: s.location,
            industry: s.industry,
            hiring_count: s.hiring_count,
            hiring_roles: s.hiring_roles,
            predicted_needs: s.predicted_needs,
            confidence: s.confidence,
            cross_referenced: s.cross_referenced,
            detected_at: s.detected_at,
            recommended_pitch: s.recommended_pitch,
          })),
          timestamp: new Date().toISOString(),
        };

        const resp = await fetch(sub.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        fired++;
        results.push({ subscriber: sub.company_name || sub.email, status: resp.status });
      } catch (e) {
        results.push({ subscriber: sub.company_name || sub.email, status: String(e) });
      }
    }

    return new Response(JSON.stringify({ fired, total_signals: signals.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
