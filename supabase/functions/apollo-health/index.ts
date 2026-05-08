// Quick Apollo key health check
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const k = Deno.env.get("APOLLO_API_KEY") || "";
  const out: any = {
    key_present: k.length > 0,
    key_length: k.length,
    key_preview: k ? `${k.slice(0, 4)}...${k.slice(-4)}` : null,
    has_whitespace: k !== k.trim(),
  };
  try {
    const r = await fetch("https://api.apollo.io/api/v1/auth/health", {
      headers: { "X-Api-Key": k.trim(), "Content-Type": "application/json", "Cache-Control": "no-cache" },
    });
    out.health_status = r.status;
    out.health_body = (await r.text()).slice(0, 500);
  } catch (e) {
    out.health_error = String(e);
  }
  // also try a tiny people search
  try {
    const r2 = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "X-Api-Key": k.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({ person_titles: ["Loan Officer"], page: 1, per_page: 1 }),
    });
    out.search_status = r2.status;
    out.search_body = (await r2.text()).slice(0, 500);
  } catch (e) {
    out.search_error = String(e);
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
