import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

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

    // ── PLACEHOLDER: Call enrichment APIs here ──
    // e.g., Hunter.io, Apollo, Clearbit, etc.
    // For now, just create a basic lead from the submission data.
    const enrichmentData = {
      source: "capture_widget",
      enriched_at: new Date().toISOString(),
      // Future: add data from enrichment APIs
    };

    // Upsert into tenant_leads
    const nameParts = (submission.name || "").split(" ");
    const { error: upsertError } = await supabase.from("tenant_leads").upsert(
      {
        tenant_id: submission.tenant_id,
        email: submission.email,
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(" ") || null,
        enrichment_data: enrichmentData,
        source: "capture_widget",
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

    // Mark submission as processed
    await supabase
      .from("capture_submissions")
      .update({ processed: true })
      .eq("id", submission_id);

    return new Response(JSON.stringify({ success: true }), {
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
