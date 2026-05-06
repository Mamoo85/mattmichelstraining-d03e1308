// Scans App.tsx for lazy-loaded routes vs files in src/pages/. Records orphan results.
// Note: Edge runtime can't read repo files. This function instead queries a manifest table
// (orphan_scan_results). The actual scan runs as a CI step via scripts/orphan-scan.ts and
// inserts results here. This endpoint just exposes them.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data, error } = await (sb.from as any)("orphan_scan_results")
    .select("*")
    .order("scanned_at", { ascending: false })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, results: data || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
