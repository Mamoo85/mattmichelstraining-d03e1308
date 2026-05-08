// hub-summary — read-only: given a bundle_token, returns the bundle's
// product tiles plus a "last 7 days" count per tile. Cannot mutate anything.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return new Response(JSON.stringify({ error: "token_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: bundle, error } = await sb
    .from("trial_bundles")
    .select("bundle_token, email, company_name, display_name, products, expires_at, created_at")
    .eq("bundle_token", token)
    .maybeSingle();

  if (error || !bundle) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const products = Array.isArray(bundle.products) ? bundle.products : [];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const enriched = await Promise.all(
    products.map(async (p: any) => {
      let count: number | null = null;
      try {
        if (p?.count_table) {
          let q = sb.from(p.count_table).select("*", { count: "exact", head: true });
          q = q.gte("created_at", since);
          const filter = p.count_filter || {};
          if (filter.buyer_type) q = q.eq("buyer_type", filter.buyer_type);
          const { count: c } = await q;
          count = typeof c === "number" ? c : null;
        }
      } catch {
        count = null;
      }
      return { ...p, count };
    }),
  );

  return new Response(
    JSON.stringify({
      ok: true,
      bundle: {
        company_name: bundle.company_name,
        display_name: bundle.display_name,
        expires_at: bundle.expires_at,
        created_at: bundle.created_at,
      },
      products: enriched,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
