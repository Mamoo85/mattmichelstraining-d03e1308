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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve tenant by domain
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
      tenantId = body.tenant_id ?? null;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve tenant for this domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine what we have to work with for the waterfall
    const targetDomain = domain || (email?.includes("@") ? email.split("@")[1] : null);

    let enrichedData: Record<string, unknown> = {};
    let enrichmentSucceeded = false;

    if (targetDomain) {
      try {
        const waterfallRes = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            domain: targetDomain,
            business_name: company || "",
          }),
        });

        if (waterfallRes.ok) {
          const data = await waterfallRes.json();
          if (data.ok && data.email) {
            enrichedData = {
              email: data.email,
              verified_email: data.verified_email || false,
              contact_name: data.contact_name || null,
              decision_maker_title: data.decision_maker_title || null,
              direct_phone: data.direct_phone || null,
              enrichment_source: data.enrichment_source || "waterfall",
            };
            enrichmentSucceeded = true;
          }
        }
      } catch (err) {
        console.error("Waterfall call failed:", err);
      }
    }

    // Use waterfall results merged with RB2B's own data
    const finalEmail = (enrichmentSucceeded ? enrichedData.email : email) as string | null;

    if (!finalEmail) {
      // Strict email filter: no email from RB2B or waterfall — discard to error log
      await supabase.from("unenriched_leads").insert({
        tenant_id: tenantId,
        raw_email: email || null,
        raw_domain: targetDomain,
        source: "rb2b",
        failure_reason: "No email from RB2B payload or waterfall enrichment",
        raw_payload: body,
      });

      return new Response(JSON.stringify({ success: false, reason: "unenriched" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build final lead record — RB2B fields as base, waterfall as overlay
    const enrichedName = enrichedData.contact_name as string | null;
    const { error: upsertError } = await supabase
      .from("tenant_leads")
      .upsert(
        {
          tenant_id: tenantId,
          email: finalEmail,
          first_name: first_name ?? enrichedName?.split(" ")[0] ?? null,
          last_name: last_name ?? enrichedName?.split(" ").slice(1).join(" ") ?? null,
          company_name: company ?? null,
          job_title: job_title ?? (enrichedData.decision_maker_title as string) ?? null,
          linkedin_url: linkedin_url ?? null,
          validated_email: (enrichedData.verified_email as boolean) || false,
          phone: (enrichedData.direct_phone as string) || null,
          source: "rb2b",
          enrichment_data: {
            rb2b_raw: { email, first_name, last_name, company, job_title, linkedin_url, domain },
            waterfall_enriched: enrichmentSucceeded,
            enrichment_source: enrichedData.enrichment_source || null,
            enriched_at: new Date().toISOString(),
          },
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

    return new Response(JSON.stringify({ success: true, enriched: enrichmentSucceeded }), {
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
