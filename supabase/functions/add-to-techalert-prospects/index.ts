// add-to-techalert-prospects — universal "convert any intel row to a prospect" endpoint.
// Called from AdminMedicareIntel, AdminIndustrialIntel, ThomasNet results, etc.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const company_name = (body.company_name || "").trim();
    if (!company_name) {
      return new Response(JSON.stringify({ error: "company_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const role = (body.role || "").trim() || null;
    const row = {
      company_name,
      city: body.city || null,
      state: body.state || "MI",
      role,
      phone: body.phone || null,
      email: body.email || null,
      website: body.website || null,
      is_boiler: !!body.is_boiler,
      score: typeof body.score === "number" ? body.score : 5,
      source_url: body.source_url || null,
      source_label: body.source_label || "manual_intel",
      notes: body.notes || null,
      status: "new",
    };

    // Upsert against the unique (lower(company_name), lower(coalesce(role,''))) index
    const { data: existing } = await sb
      .from("techalert_prospect_targets")
      .select("id")
      .ilike("company_name", company_name)
      .eq("role", role || "")
      .maybeSingle();

    if (existing?.id) {
      await sb.from("techalert_prospect_targets").update({
        ...row,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      return new Response(JSON.stringify({ ok: true, id: existing.id, action: "updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await sb.from("techalert_prospect_targets").insert(row).select("id").single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: data?.id, action: "inserted" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
