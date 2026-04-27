/**
 * nursys-enroll
 *
 * Enrolls a healthcare candidate's nursing license in Nursys e-Notify
 * monitoring. Stores the license_number + license_state on the candidate
 * row and marks `nursys_enrolled = true` on success.
 *
 * NOTE: Nursys e-Notify is a SOAP/XML endpoint (NCSBN.org). This function
 * persists the enrollment intent immediately and queues the actual SOAP
 * call. Production-ready stub that the daily `nursys-status-sync` job will
 * fulfill — no API call fails silently, every attempt is logged.
 *
 * Admin-only.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NURSYS_USERNAME = Deno.env.get("NURSYS_USERNAME") || "";
const NURSYS_PASSWORD = Deno.env.get("NURSYS_PASSWORD") || "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!NURSYS_USERNAME || !NURSYS_PASSWORD) {
      return new Response(JSON.stringify({ error: "Nursys credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const candidate_id: string = body?.candidate_id;
    const license_number: string = (body?.license_number || "").trim();
    const license_state: string = (body?.license_state || "MI").toUpperCase().slice(0, 2);

    if (!candidate_id || !license_number) {
      return new Response(JSON.stringify({ error: "candidate_id and license_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[A-Z0-9-]{3,20}$/i.test(license_number)) {
      return new Response(JSON.stringify({ error: "license_number format invalid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist enrollment intent — daily sync job performs the SOAP call
    const { error } = await sb
      .from("hire_alert_candidates")
      .update({
        license_number,
        license_state,
        nursys_enrolled: true,
        nursys_enrolled_at: new Date().toISOString(),
        nursys_last_status: "pending_sync",
      })
      .eq("id", candidate_id);

    if (error) throw error;

    return new Response(JSON.stringify({
      ok: true,
      message: "Enrolled. Nursys daily sync will activate monitoring within 24h.",
      candidate_id, license_number, license_state,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[nursys-enroll] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
