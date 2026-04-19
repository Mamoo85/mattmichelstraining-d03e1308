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
    // Auth via bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find contractor client for this user
    const { data: contractor } = await sbAdmin.from("contractor_clients")
      .select("id, trade, city, state, roi_token")
      .eq("email", user.email)
      .eq("active", true)
      .maybeSingle();

    if (!contractor) {
      return new Response(JSON.stringify({ available_leads: [], missed_count: 0, roi_token: null }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Available leads in last 24h matching trade/city via the joined site row
    let leadsQuery = sbAdmin.from("contractor_leads")
      .select("id, name, phone, project_type, created_at, status, contractor_lead_sites!inner(trade, city, state)")
      .eq("status", "available")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (contractor.trade) {
      leadsQuery = leadsQuery.ilike("contractor_lead_sites.trade", `%${contractor.trade}%`);
    }
    if (contractor.city) {
      leadsQuery = leadsQuery.ilike("contractor_lead_sites.city", `%${contractor.city}%`);
    }

    const { data: leads } = await leadsQuery;

    // FOMO: count leads this contractor tried to buy but were already sold
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: missedCount } = await sbAdmin.from("contractor_lead_views")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", contractor.id)
      .gte("created_at", sevenDaysAgo);

    return new Response(JSON.stringify({
      available_leads: (leads || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        project_type: l.project_type,
        city: l.contractor_lead_sites?.city || null,
        trade: l.contractor_lead_sites?.trade || null,
        created_at: l.created_at,
      })),
      missed_count: missedCount || 0,
      roi_token: contractor.roi_token,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-contractor-signals]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
