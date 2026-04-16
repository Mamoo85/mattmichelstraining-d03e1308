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
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate client
    const { data: client } = await sb.from("hire_alert_clients")
      .select("id, company_name, target_roles, active")
      .eq("dashboard_token", token)
      .eq("active", true)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const targetRoles = client.target_roles || [];

    // Try industry_pulse_signals first (confidence >= 7)
    const { data: signals } = await sb.from("industry_pulse_signals")
      .select("*")
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(10);

    if (signals && signals.length > 0) {
      // Filter signals that match client's tracked industries/roles
      const filtered = signals.filter((s: any) => {
        if (!s.hiring_roles || !Array.isArray(s.hiring_roles)) return true;
        // Show if any hiring role overlaps with target_roles, or if no target_roles set
        if (targetRoles.length === 0) return true;
        return s.hiring_roles.some((r: string) =>
          targetRoles.some((tr: string) => r.toLowerCase().includes(tr.toLowerCase()) || tr.toLowerCase().includes(r.toLowerCase()))
        );
      });

      if (filtered.length > 0) {
        return new Response(JSON.stringify({
          type: "signals",
          items: filtered.slice(0, 10).map((s: any) => ({
            id: s.id,
            company_name: s.company_name,
            location: s.location,
            industry: s.industry,
            signal_type: s.cross_referenced ? "cross_referenced" : (s.hiring_count && s.hiring_count >= 3 ? "hiring_pattern" : "expansion"),
            confidence: s.confidence,
            recommended_pitch: s.recommended_pitch,
            hiring_roles: s.hiring_roles,
            predicted_needs: s.predicted_needs,
            detected_at: s.detected_at,
          })),
        }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: hot candidates from last 48h
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: hotCandidates } = await sb.from("hire_alert_candidates")
      .select("id, full_name, city, license_type, license_number, license_expiry, availability_score, qualifications_summary, current_employer, linkedin_url, facebook_url, email, phone, alerted_at")
      .gte("availability_score", 8)
      .gte("alerted_at", cutoff)
      .order("availability_score", { ascending: false })
      .limit(10);

    return new Response(JSON.stringify({
      type: hotCandidates && hotCandidates.length > 0 ? "hot_candidates" : "empty",
      items: (hotCandidates || []).map((c: any) => ({
        id: c.id,
        company_name: c.current_employer || c.full_name,
        full_name: c.full_name,
        location: c.city,
        signal_type: "hiring_pattern",
        confidence: c.availability_score,
        recommended_pitch: c.qualifications_summary,
        detected_at: c.alerted_at,
        license_number: c.license_number || null,
        license_type: c.license_type || null,
        license_expiry: c.license_expiry || null,
        linkedin_url: c.linkedin_url || null,
        facebook_url: c.facebook_url || null,
        email: c.email || null,
        phone: c.phone || null,
      })),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-techalert-signals]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
