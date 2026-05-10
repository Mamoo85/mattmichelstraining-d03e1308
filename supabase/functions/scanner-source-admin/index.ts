// Admin endpoint: list sources, get toggles/health, run a source.
// Auth: requires caller to be admin (uses anon key + user JWT + has_role check).
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { runPhaseAExtras, SUPPORTED_PRODUCTS, listProductSources } from "../_shared/scanner-extras-dispatcher.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return false;
  const svc = createClient(SUPABASE_URL, SVC);
  const { data, error } = await svc.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (error) return false;
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = await isAdmin(req.headers.get("Authorization"));
    if (!admin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const svc = createClient(SUPABASE_URL, SVC);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "list" : "");

    if (action === "list") {
      const products = SUPPORTED_PRODUCTS.map((p) => ({ product: p, sources: listProductSources(p) }));
      const { data: toggles } = await svc.from("scanner_source_toggles").select("*");
      const { data: recent } = await svc
        .from("scanner_extras_runs")
        .select("product, source, segment, count, ms, error, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      return new Response(JSON.stringify({ products, toggles: toggles || [], recent: recent || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "toggle") {
      const { product, source, segment = "all", enabled, notes } = body || {};
      if (!product || !source || typeof enabled !== "boolean") {
        return new Response(JSON.stringify({ error: "product, source, enabled required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await svc.from("scanner_source_toggles").upsert(
        { product, source, segment, enabled, notes: notes ?? null },
        { onConflict: "product,source,segment" },
      );
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "run") {
      const { product, source, segment = "all" } = body || {};
      if (!product) {
        return new Response(JSON.stringify({ error: "product required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await runPhaseAExtras(product, { segment, onlySource: source });
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
