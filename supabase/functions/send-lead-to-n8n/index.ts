import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const N8N_MCP_URL = Deno.env.get("N8N_MCP_URL") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { lead, pain_points } = await req.json();

    if (!lead?.id) {
      return new Response(
        JSON.stringify({ error: "lead with id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!N8N_MCP_URL) {
      return new Response(
        JSON.stringify({ error: "N8N_MCP_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      source: "m2_prospector",
      business_name: lead.business_name,
      contact_name: lead.contact_name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      website: lead.website || null,
      city: lead.city || null,
      state: lead.state || null,
      industry: lead.industry || null,
      google_rating: lead.google_rating || null,
      review_count: lead.review_count || null,
      pain_points: pain_points || [],
      deep_research: lead.deep_research || null,
      pipeline_id: lead.id,
    };

    console.log(`[SEND-TO-N8N] Sending lead: ${lead.business_name}`);

    const n8nRes = await fetch(N8N_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      console.error(`[SEND-TO-N8N] n8n error [${n8nRes.status}]: ${errText.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: `n8n returned ${n8nRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update timestamp in pipeline
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb
        .from("prospect_pipeline")
        .update({ n8n_sent_at: new Date().toISOString(), pipeline_stage: "outreach_sent" })
        .eq("id", lead.id);
    }

    console.log(`[SEND-TO-N8N] Success for ${lead.business_name}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SEND-TO-N8N] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
