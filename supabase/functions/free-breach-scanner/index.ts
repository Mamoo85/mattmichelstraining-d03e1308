const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { domain, email } = await req.json();
    if (!domain || !email) {
      return new Response(JSON.stringify({ error: "domain and email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call HIBP breaches by domain (no API key needed for domain search)
    const hibpRes = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "User-Agent": "DetroitWebAgency-BreachScanner" },
    });

    let breaches = [];
    if (hibpRes.ok) {
      breaches = await hibpRes.json();
    } else {
      const text = await hibpRes.text();
      console.log("HIBP response:", hibpRes.status, text);
    }

    const results = {
      domain,
      breach_count: breaches.length,
      breaches: breaches.slice(0, 10).map((b: any) => ({
        name: b.Name,
        title: b.Title,
        date: b.BreachDate,
        pwn_count: b.PwnCount,
        data_classes: b.DataClasses,
        description: b.Description?.replace(/<[^>]*>/g, "").slice(0, 200),
      })),
      risk_level: breaches.length === 0 ? "LOW" : breaches.length <= 2 ? "MEDIUM" : "HIGH",
    };

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("free_tool_leads").insert({ email, tool_used: "breach-scan", input_url: domain, results_summary: results });

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("free-breach-scanner error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
