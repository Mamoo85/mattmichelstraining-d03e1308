// dwa-ad-optimizer — Smart Ad Budget Agent (every 6h)
// Reads contractor_ad_spend trailing 30d, applies budget logic, writes recommendation.
// - 5+ leads in 30d AND spend>$100 → cut budget 50%
// - 0 leads in 14d → increase 25% (cap $200)
// - At $200 cap with <3 leads in 30d → SMS Matt to investigate
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const CAP = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const adjustments: any[] = [];
  const investigations: any[] = [];

  try {
    const { data: contractors } = await sb
      .from("contractor_clients" as any)
      .select("id, business_name, phone")
      .eq("active", true);

    if (!contractors?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const cutoff30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const cutoff14 = new Date(now.getTime() - 14 * 86400000).toISOString();

    for (const c of contractors as any[]) {
      // Get trailing 30d ad spend
      const { data: spendRows } = await sb
        .from("contractor_ad_spend" as any)
        .select("spend_usd, recommended_budget_next_30d, month")
        .eq("contractor_id", c.id)
        .order("month", { ascending: false })
        .limit(2);

      const currentSpend = Number((spendRows as any)?.[0]?.spend_usd || 0);
      const currentBudget = Number((spendRows as any)?.[0]?.recommended_budget_next_30d || 100);

      // Count leads delivered in trailing windows
      const { count: leads30 } = await sb
        .from("contractor_leads" as any)
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", c.id)
        .gte("created_at", cutoff30);

      const { count: leads14 } = await sb
        .from("contractor_leads" as any)
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", c.id)
        .gte("created_at", cutoff14);

      let newBudget = currentBudget;
      let reason = "no_change";

      if ((leads30 || 0) >= 5 && currentSpend > 100) {
        newBudget = Math.max(50, Math.round(currentBudget * 0.5));
        reason = `5+ leads in 30d (${leads30}) with spend $${currentSpend} — cut 50%`;
      } else if ((leads14 || 0) === 0) {
        newBudget = Math.min(CAP, Math.round(currentBudget * 1.25));
        reason = `0 leads in 14d — boost 25% (cap $${CAP})`;
      }

      // Investigation alert
      if (currentBudget >= CAP && (leads30 || 0) < 3) {
        investigations.push({ id: c.id, name: c.business_name, leads30, currentBudget });
      }

      // Upsert this month's row + log change if budget moved
      await sb.from("contractor_ad_spend" as any).upsert({
        contractor_id: c.id,
        month: monthKey,
        spend_usd: currentSpend,
        recommended_budget_next_30d: newBudget,
        leads_delivered: leads30 || 0,
      }, { onConflict: "contractor_id,month" });

      if (newBudget !== currentBudget) {
        await sb.from("contractor_ad_budget_log" as any).insert({
          contractor_id: c.id,
          old_budget: currentBudget,
          new_budget: newBudget,
          reason,
          agent: "dwa-ad-optimizer",
          metadata: { leads_30d: leads30, leads_14d: leads14, spend_usd: currentSpend },
        });
        adjustments.push({ name: c.business_name, old: currentBudget, new: newBudget, reason });
      }
    }

    // SMS Matt about investigations (single batched SMS)
    if (investigations.length && ADMIN_PHONE) {
      const lines = investigations.slice(0, 5).map(i => `• ${i.name}: ${i.leads30 || 0} leads/30d at $${i.currentBudget} cap`).join("\n");
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE_NUMBER,
        `DWA-OPTIMIZER: ${investigations.length} contractor(s) at budget cap with low yield. Investigate:\n${lines}`,
        "dwa_ad_optimizer"
      );
    }

    // Heartbeat
    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "dwa-ad-optimizer",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { processed: contractors.length, adjustments: adjustments.length, investigations: investigations.length },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, processed: contractors.length, adjustments, investigations: investigations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dwa-ad-optimizer] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
