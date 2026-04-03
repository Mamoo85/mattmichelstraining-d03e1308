import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function searchGrants(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    const data = await res.json();
    return (data.data || []).map((r: { title: string; url: string; markdown: string }) =>
      `SOURCE: ${r.title}\nURL: ${r.url}\n${r.markdown?.slice(0, 800)}`
    ).join("\n\n---\n\n");
  } catch { return ""; }
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  return (await res.json()).content?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: clients } = await sb.from("grant_discovery_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ message: "No active clients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results = [];
    for (const client of clients) {
      try {
        const causeAreas = client.cause_areas || "nonprofit services";
        const geography = client.geography || "United States";
        const [s1, s2, s3] = await Promise.all([
          searchGrants(`foundation grants "${causeAreas}" ${geography} 2026 applications open`),
          searchGrants(`government grants nonprofits "${causeAreas}" ${geography} 2026`),
          searchGrants(`corporate philanthropy "${causeAreas}" ${geography} nonprofit grant`),
        ]);
        const prompt = `You are a grant research specialist. Find funding for this nonprofit:\n\nORG: ${client.org_name}\nMISSION: ${client.mission}\nGEOGRAPHY: ${geography}\nCAUSE AREAS: ${causeAreas}\n\nSEARCH RESULTS:\n${[s1,s2,s3].join("\n\n===\n\n")}\n\nList 8-12 matching grant opportunities. For each: grant name/funder, fit score 1-100, estimated award, deadline, URL, 2-sentence fit explanation. Numbered list. Only include real, verifiable grants.`;
        const grantList = await callClaude(prompt);
        const grantCount = (grantList.match(/^\d+\./gm) || []).length;
        const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#e8621a;padding:24px 32px"><h1 style="color:white;margin:0;font-size:20px;font-weight:900">Weekly Grant Report</h1><p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px">${client.org_name} · ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p></div><div style="padding:32px"><p style="color:#475569;font-size:14px;margin:0 0 20px">This week's funding opportunities matched to your mission in ${geography}. Ranked by fit score.</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.7;color:#334155">${grantList}</div><p style="font-size:12px;color:#94a3b8;margin:20px 0 0">Always verify deadlines and eligibility directly with the funder before applying. Questions? <a href="tel:+13138064952" style="color:#e8621a">(313) 806-4952</a></p></div></div>`;
        await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [client.email], subject: `${grantCount} Grant Opportunities for ${client.org_name} — Week of ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric"})}`, html }) });
        await sb.from("grant_discovery_clients").update({ last_report_at: new Date().toISOString() }).eq("id", client.id);
        results.push({ email: client.email, grants: grantCount });
      } catch (err) { console.error(`Failed for ${client.email}:`, err); }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
