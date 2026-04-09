import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN")!;
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, email } = await req.json();
    if (!url || !email) {
      return new Response(JSON.stringify({ error: "url and email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const creds = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const dfsRes = await fetch("https://api.dataforseo.com/v3/on_page/instant_pages", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ url }]),
    });
    const dfsData = await dfsRes.json();

    const page = dfsData?.tasks?.[0]?.result?.[0]?.items?.[0] || {};
    const meta = page.meta || {};

    const titleLen = (meta.title || "").length;
    const descLen = (meta.description || "").length;

    const checks = [
      { label: "Title Tag", value: meta.title || "Missing", status: titleLen >= 30 && titleLen <= 60 ? "pass" : titleLen > 0 ? "warn" : "fail", detail: `${titleLen} chars (ideal: 30-60)` },
      { label: "Meta Description", value: (meta.description || "Missing").slice(0, 100), status: descLen >= 120 && descLen <= 160 ? "pass" : descLen > 0 ? "warn" : "fail", detail: `${descLen} chars (ideal: 120-160)` },
      { label: "Canonical Tag", value: meta.canonical || "Not set", status: meta.canonical ? "pass" : "fail", detail: meta.canonical ? "Properly set" : "Missing — may cause duplicate content" },
      { label: "Robots Meta", value: meta.robots || "Not set", status: meta.robots ? "pass" : "warn", detail: meta.robots || "No robots directive found" },
      { label: "Open Graph", value: meta.open_graph?.title ? "Present" : "Missing", status: meta.open_graph?.title ? "pass" : "warn", detail: meta.open_graph?.title || "No OG title found" },
      { label: "H1 Tags", value: `${meta.htags?.h1?.length || 0} found`, status: (meta.htags?.h1?.length || 0) === 1 ? "pass" : "warn", detail: meta.htags?.h1?.[0] || "No H1 tag" },
    ];

    const passCount = checks.filter(c => c.status === "pass").length;
    const grade = passCount >= 5 ? "A" : passCount >= 4 ? "B" : passCount >= 3 ? "C" : passCount >= 2 ? "D" : "F";

    const results = { url, checks, grade, pass_count: passCount, total: checks.length };

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("free_tool_leads").insert({ email, tool_used: "meta-analyzer", input_url: url, results_summary: results });

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("free-meta-analyzer error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
