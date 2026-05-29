import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Send real-time SMS notifications for high-confidence Demand Radar signals.
 * Called after industry-pulse-scanner completes.
 *
 * Body: { min_confidence?: number }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const minConf = body.min_confidence || 7;

    // Get high-confidence signals from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await supabase
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_count, hiring_roles, predicted_needs, confidence, cross_referenced")
      .gte("confidence", minConf)
      .gte("detected_at", since)
      .order("confidence", { ascending: false })
      .limit(10);

    if (!signals?.length) {
      return new Response(JSON.stringify({
        sent: 0,
        reason: "No high-confidence signals in last 24h",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get Demand Radar subscribers with SMS alerts
    const { data: subscribers } = await supabase
      .from("industry_pulse_subscribers")
      .select("id, email, phone, company_name, target_industries, territory_zips")
      .eq("active", true)
      .not("phone", "is", null);

    if (!subscribers?.length) {
      return new Response(JSON.stringify({
        sent: 0,
        reason: "No subscribers with phone numbers",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalSent = 0;
    const results: { subscriber: string; sent: number; error?: string }[] = [];

    for (const sub of subscribers) {
      // Filter signals by subscriber's target industries
      const targetInds: string[] = sub.target_industries || [];
      const relevant = targetInds.length > 0 && !targetInds.includes("all")
        ? signals.filter((s: any) => targetInds.some((t: string) => (s.industry || "").toLowerCase().includes(t.toLowerCase())))
        : signals;

      if (relevant.length === 0) {
        results.push({ subscriber: sub.company_name || sub.email, sent: 0 });
        continue;
      }

      const top = relevant[0];
      const rolesStr = (top.hiring_roles || []).slice(0, 2).join(", ");
      const needsStr = (top.predicted_needs || []).slice(0, 2).join(", ");

      const message = `Demand Radar: ${top.company_name} (${top.location || "MI"}) hiring ${top.hiring_count}+ ${rolesStr}. Confidence: ${top.confidence}/10${top.cross_referenced ? " [CROSS-REF]" : ""}\n\nPredicted needs: ${needsStr}\n\n${relevant.length > 1 ? `+${relevant.length - 1} more signals today\n\n` : ""}View dashboard: https://detroitwebagent.com/my-industry-pulse?token=${sub.id}\n\nReply STOP to unsubscribe`;

      try {
        await sendSMS(supabase, {
          to: sub.phone,
          body: message,
          client_id: sub.id,
          purpose: "demand_radar_signal_sms",
        });
        totalSent++;
        results.push({ subscriber: sub.company_name || sub.email, sent: 1 });
      } catch (e) {
        results.push({ subscriber: sub.company_name || sub.email, sent: 0, error: String(e) });
      }
    }

    return new Response(JSON.stringify({
      sent: totalSent,
      signals_found: signals.length,
      subscribers_notified: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
