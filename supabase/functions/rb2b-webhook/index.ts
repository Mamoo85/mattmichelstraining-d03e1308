import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      email,
      first_name,
      last_name,
      company,
      job_title,
      linkedin_url,
      domain,
    } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up tenant by domain
    let tenantId: string | null = null;
    if (domain) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("domain", domain)
        .maybeSingle();
      tenantId = tenant?.id ?? null;
    }

    if (!tenantId) {
      // Fallback: check body.tenant_id if passed directly
      tenantId = body.tenant_id ?? null;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve tenant for this domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert lead by email + tenant
    const { error: upsertError } = await supabase
      .from("tenant_leads")
      .upsert(
        {
          tenant_id: tenantId,
          email,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          company_name: company ?? null,
          job_title: job_title ?? null,
          linkedin_url: linkedin_url ?? null,
          source: "rb2b",
        },
        { onConflict: "tenant_id,email", ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("rb2b-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
