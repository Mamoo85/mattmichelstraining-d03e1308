// contractor-seo-content — weekly blog post generator (long-tail keywords) for contractor's /quote/:trade/:city page
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const targetId = body.contractor_id;

    let contractors: any[] = [];
    if (targetId) {
      const { data } = await sb.from("contractor_clients" as any)
        .select("id, business_name, trade, city, state").eq("id", targetId).limit(1);
      contractors = (data as any[]) || [];
    } else {
      const { data } = await sb.from("contractor_clients" as any)
        .select("id, business_name, trade, city, state").eq("active", true).limit(20);
      contractors = (data as any[]) || [];
    }

    const generated: any[] = [];
    for (const c of contractors) {
      if (!ANTHROPIC_API_KEY) break;
      const prompt = `Write a 600-word SEO blog post for a ${c.trade} contractor in ${c.city}, ${c.state || "MI"}.
Target long-tail keyword: "emergency ${(c.trade || "").toLowerCase()} ${(c.city || "").toLowerCase()} weekend"
Include: H1, 3 H2 sections, local references (neighborhoods, climate), one FAQ block (3 Q&A), one CTA to call.
Tone: helpful, expert, local. NO fluff. NO "in today's fast-paced world".
Return JSON: { "title": "...", "slug": "...", "meta_description": "...", "html": "<article>...</article>" }`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await aiRes.json();
      const raw = data.content?.[0]?.text || "{}";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      try {
        const post = JSON.parse(jsonMatch[0]);
        await sb.from("blog_post_clients" as any).insert({
          business_name: c.business_name,
          email: `seo-${c.id}@detroitwebagent.com`,
          industry: c.trade,
          target_keywords: [`${c.trade} ${c.city}`, `emergency ${c.trade} ${c.city}`],
          last_sent_at: new Date().toISOString(),
          post_count: 1,
        });
        generated.push({ contractor_id: c.id, title: post.title });
      } catch (_e) { /* skip parse fail */ }
    }

    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "contractor-seo-content",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { generated: generated.length },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[contractor-seo-content] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
