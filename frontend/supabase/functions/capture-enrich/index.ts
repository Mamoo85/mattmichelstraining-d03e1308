import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabase
      .from("capture_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (fetchError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (submission.processed) {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = submission.email;
    const tenantId = submission.tenant_id;
    const nameParts = (submission.name || "").split(" ");
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(" ") || null;

    // Extract domain from email for waterfall lookup
    const emailDomain = email.includes("@") ? email.split("@")[1] : null;

    let enrichedData: Record<string, unknown> = {};
    let enrichmentSucceeded = false;

    if (emailDomain) {
      try {
        const waterfallRes = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            domain: emailDomain,
            business_name: "",
          }),
        });

        if (waterfallRes.ok) {
          const data = await waterfallRes.json();
          if (data.ok && data.email) {
            enrichedData = {
              verified_email: data.verified_email || false,
              first_name: data.contact_name?.split(" ")[0] || firstName,
              last_name: data.contact_name?.split(" ").slice(1).join(" ") || lastName,
              job_title: data.decision_maker_title || null,
              phone: data.direct_phone || null,
              enrichment_source: data.enrichment_source || "waterfall",
            };
            enrichmentSucceeded = true;
          }
        }
      } catch (err) {
        console.error("Waterfall call failed:", err);
      }
    }

    if (enrichmentSucceeded) {
      // Save enriched lead to tenant_leads
      const { error: upsertError } = await supabase.from("tenant_leads").upsert(
        {
          tenant_id: tenantId,
          email,
          first_name: enrichedData.first_name as string || firstName,
          last_name: enrichedData.last_name as string || lastName,
          validated_email: enrichedData.verified_email as boolean || false,
          job_title: enrichedData.job_title as string || null,
          phone: enrichedData.phone as string || null,
          source: "capture_widget",
          enrichment_data: {
            source: "capture_widget",
            enrichment_source: enrichedData.enrichment_source,
            enriched_at: new Date().toISOString(),
          },
        },
        { onConflict: "tenant_id,email", ignoreDuplicates: false }
      );

      if (upsertError) {
        console.error("Lead upsert error:", upsertError);
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Strict email filter: log to unenriched_leads
      await supabase.from("unenriched_leads").insert({
        tenant_id: tenantId,
        raw_email: email,
        raw_domain: emailDomain,
        source: "capture_widget",
        failure_reason: "Waterfall returned no verified email",
        raw_payload: { name: submission.name, email, source_url: submission.source_url },
      });
    }

    // Mark submission as processed
    await supabase
      .from("capture_submissions")
      .update({ processed: true })
      .eq("id", submission_id);

    return new Response(JSON.stringify({ success: true, enriched: enrichmentSucceeded }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("capture-enrich error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
