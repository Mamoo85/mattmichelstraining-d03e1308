// Agency clicks "Mark No-Show" → flags candidate as ghost, grants 1 free fast-track credit.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignment_id, agency_id, reason } = await req.json();
    if (!assignment_id || !agency_id) throw new Error("assignment_id and agency_id required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify assignment belongs to this agency and was actually booked (only booked interviews can ghost)
    const { data: assignment } = await sb
      .from("agency_candidate_assignments")
      .select("id, status, ghosted_at, agency_id")
      .eq("id", assignment_id)
      .eq("agency_id", agency_id)
      .single();
    if (!assignment) throw new Error("Assignment not found");
    if (assignment.ghosted_at) throw new Error("Already marked as ghost");
    if (assignment.status !== "interview_booked") throw new Error("Can only ghost booked interviews");

    // Mark ghosted
    await sb.from("agency_candidate_assignments").update({
      ghosted_at: new Date().toISOString(),
      ghost_reason: reason || null,
      status: "ghosted",
    }).eq("id", assignment_id);

    // Grant credit (atomic increment via RPC-style raw update)
    const { data: agency } = await sb
      .from("staffing_agency_clients")
      .select("fast_track_credits, agency_name, is_test_account")
      .eq("id", agency_id)
      .single();
    const newCredits = (agency?.fast_track_credits ?? 0) + 1;
    await sb.from("staffing_agency_clients")
      .update({ fast_track_credits: newCredits })
      .eq("id", agency_id);

    // Log
    await sb.from("system_comms_log").insert({
      channel: "system",
      product: "talent_signal",
      recipient: agency_id,
      body_preview: `Ghost reported: ${assignment_id} — credit granted (${newCredits} total)`,
      status: "logged",
      metadata: { assignment_id, agency_id, reason: reason || null },
    }).then(() => {}, () => {});

    // SMS Matt via shared sendSMS (TCPA + sinkhole compliant)
    if (TWILIO_FROM) {
      const prefix = agency?.is_test_account ? "[TEST SINKHOLE] " : "";
      const msg = `${prefix}👻 ${agency?.agency_name || agency_id} reported ghost · 1 free fast-track credit granted (now ${newCredits})`;
      try {
        await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "dwa_admin_reply");
      } catch (e) { console.warn("[silent-catch]", e instanceof Error ? e.message : e); }
    }

    return new Response(JSON.stringify({ ok: true, credits: newCredits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
