const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("APOLLO_API_KEY") || "";
  const masked = key ? `${key.slice(0, 4)}...${key.slice(-4)} (len ${key.length})` : "MISSING";

  try {
    const r = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": key,
      },
      body: JSON.stringify({
        q_organization_domains: "detroitwebagent.com",
        page: 1,
        per_page: 3,
      }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    return new Response(
      JSON.stringify({
        key: masked,
        status: r.status,
        ok: r.ok,
        people_count: parsed?.people?.length ?? null,
        contacts_count: parsed?.contacts?.length ?? null,
        sample: parsed?.people?.[0]
          ? { name: parsed.people[0].name, title: parsed.people[0].title, org: parsed.people[0].organization?.name }
          : null,
        error: parsed?.error || (r.ok ? null : text.slice(0, 300)),
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ key: masked, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
