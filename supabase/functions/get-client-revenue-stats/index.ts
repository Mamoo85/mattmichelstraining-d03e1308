// Recovered Revenue Ledger — calculates total revenue recovered across all DWA products
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = new URL(req.url);
    const contractorId = url.searchParams.get("contractor_id");
    const roiToken = url.searchParams.get("token");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let contractor: any = null;

    if (roiToken) {
      const { data } = await sb.from("contractor_clients")
        .select("id, business_name, average_ticket_value")
        .eq("roi_token", roiToken)
        .eq("active", true)
        .maybeSingle();
      contractor = data;
    } else if (contractorId) {
      const { data } = await sb.from("contractor_clients")
        .select("id, business_name, average_ticket_value")
        .eq("id", contractorId)
        .maybeSingle();
      contractor = data;
    }

    if (!contractor) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const ticketValue = contractor.average_ticket_value || 500;

    // Count leads delivered (purchased)
    const { count: leadsDelivered } = await sb
      .from("contractor_lead_purchases")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", contractor.id);

    // Count dead leads revived (positive replies)
    const { count: deadLeadsRevived } = await sb
      .from("dead_lead_contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "positive")
      .in("campaign_id", 
        (await sb.from("dead_lead_campaigns").select("id").eq("contractor_id", contractor.id)).data?.map((c: any) => c.id) || []
      );

    // Count missed calls caught
    const { count: missedCallsCaught } = await sb
      .from("system_comms_log")
      .select("id", { count: "exact", head: true })
      .eq("product", "missed_call")
      .eq("status", "sent")
      .ilike("recipient", `%${contractor.id}%`);

    const leads = leadsDelivered || 0;
    const deadLeads = deadLeadsRevived || 0;
    const missedCalls = missedCallsCaught || 0;

    const totalRevenue = (leads + deadLeads + missedCalls) * ticketValue;

    return new Response(JSON.stringify({
      contractor_id: contractor.id,
      business_name: contractor.business_name,
      average_ticket_value: ticketValue,
      leads_delivered: leads,
      dead_leads_revived: deadLeads,
      missed_calls_caught: missedCalls,
      total_revenue_recovered: totalRevenue,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[revenue-stats]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
