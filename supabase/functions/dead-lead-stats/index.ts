// dead-lead-stats — GET endpoint for /dead-lead-stats?token=XYZ magic link
// Looks up contractor by roi_token, returns campaign stats. No auth needed.

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

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: contractor } = await sb
      .from("contractor_clients")
      .select("id, business_name, active")
      .eq("roi_token", token)
      .single();

    if (!contractor || !contractor.active) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Get all campaigns for this contractor
    const { data: campaigns } = await sb
      .from("dead_lead_campaigns" as any)
      .select("id, trade, status")
      .eq("contractor_id", contractor.id);

    const campaignIds = (campaigns || []).map((c: any) => c.id);

    if (campaignIds.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        stats: {
          business_name: contractor.business_name || "Your Business",
          campaigns: 0,
          total_contacts: 0,
          texts_sent: 0,
          positive_replies: 0,
          opt_outs: 0,
          revenue_recovered: 0,
        },
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Count contacts by status across all campaigns
    const { data: contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("status")
      .in("campaign_id", campaignIds);

    const allContacts = contacts || [];
    const totalContacts = allContacts.length;

    const sentStatuses = new Set(["drip1_sent", "drip2_sent", "drip3_sent", "replied_positive", "replied_negative", "hard_no", "opted_out", "tcpa_expired"]);
    const textsSent = allContacts.filter((c: any) => sentStatuses.has(c.status)).length;
    const positiveReplies = allContacts.filter((c: any) => c.status === "replied_positive").length;
    const optOuts = allContacts.filter((c: any) => c.status === "opted_out").length;

    // Revenue: sum charges or fall back to $50 × positives
    const { data: charges } = await sb
      .from("dead_lead_charges" as any)
      .select("amount")
      .eq("contractor_id", contractor.id);

    const revenueRecovered = (charges || []).length > 0
      ? (charges || []).reduce((sum: number, c: any) => sum + (c.amount || 5000), 0) / 100
      : positiveReplies * 50;

    return new Response(JSON.stringify({
      ok: true,
      stats: {
        business_name: contractor.business_name || "Your Business",
        campaigns: campaignIds.length,
        total_contacts: totalContacts,
        texts_sent: textsSent,
        positive_replies: positiveReplies,
        opt_outs: optOuts,
        revenue_recovered: revenueRecovered,
      },
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
