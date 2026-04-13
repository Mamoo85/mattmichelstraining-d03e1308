// get-my-techalert — GET endpoint for /my-techalert?token=XYZ
// Token-secured dashboard data. Never returns source field.

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
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up client by dashboard_token
    const { data: client, error: clientErr } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, target_roles, target_zip_codes, active, owner_email")
      .eq("dashboard_token", token)
      .single();

    if (clientErr || !client || !client.active) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get all candidates alerted to this client (joined with candidate details)
    const { data: clientCandidates } = await sb
      .from("hire_alert_client_candidates")
      .select("candidate_id, alerted_at, client_action")
      .eq("client_id", client.id)
      .order("alerted_at", { ascending: false })
      .limit(500);

    if (!clientCandidates || !clientCandidates.length) {
      return new Response(JSON.stringify({
        client: {
          company_name: client.company_name,
          target_roles: client.target_roles || [],
          target_zip_codes: client.target_zip_codes || [],
        },
        candidates: [],
        kpi: { total: 0, hot: 0, contacted: 0, hired: 0 },
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch candidate details — EXCLUDE source field
    const candidateIds = clientCandidates.map((cc: any) => cc.candidate_id);
    const { data: candidates } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, phone, email, license_type, license_number, license_expiry, city, zip, availability_score, score_reason, qualifications_summary, hiring_recommendation, linkedin_url, facebook_url, current_employer, current_title, years_experience")
      .in("id", candidateIds);

    // Merge candidate details with alert info
    const candidateMap = new Map((candidates || []).map((c: any) => [c.id, c]));
    const merged = clientCandidates
      .map((cc: any) => {
        const c = candidateMap.get(cc.candidate_id);
        if (!c) return null;
        return {
          id: c.id,
          full_name: c.full_name,
          phone: c.phone,
          email: c.email,
          license_type: c.license_type,
          license_number: c.license_number,
          license_expiry: c.license_expiry,
          city: c.city,
          availability_score: c.availability_score,
          score_reason: c.score_reason,
          qualifications_summary: c.qualifications_summary,
          hiring_recommendation: c.hiring_recommendation,
          linkedin_url: c.linkedin_url,
          facebook_url: c.facebook_url,
          current_employer: c.current_employer,
          current_title: c.current_title,
          years_experience: c.years_experience,
          alerted_at: cc.alerted_at,
          client_action: cc.client_action,
        };
      })
      .filter(Boolean);

    // KPI
    const kpi = {
      total: merged.length,
      hot: merged.filter((c: any) => c.availability_score >= 7).length,
      contacted: merged.filter((c: any) => c.client_action === "contacted").length,
      hired: merged.filter((c: any) => c.client_action === "hired").length,
    };

    return new Response(JSON.stringify({
      client: {
        company_name: client.company_name,
        target_roles: client.target_roles || [],
        target_zip_codes: client.target_zip_codes || [],
      },
      candidates: merged,
      kpi,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[get-my-techalert]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
