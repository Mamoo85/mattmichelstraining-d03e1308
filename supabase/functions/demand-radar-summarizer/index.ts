// DR-17: AI signal summarizer — daily 3-bullet brief
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_id } = await req.json().catch(() => ({}));

    const since = new Date(Date.now() - 86400_000).toISOString();
    const { data: signals } = await supabase
      .from("growth_radar_signals" as any)
      .select("company_name, signal_type, vertical, value_usd, recommended_pitch, confidence")
      .gte("detected_at", since)
      .order("confidence", { ascending: false })
      .limit(15);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ brief: "No new signals in the last 24h. Check back tomorrow.", count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const summary = (signals as any[]).map((s) => `${s.company_name} (${s.vertical || "?"}): ${s.signal_type} — conf ${s.confidence}/10`).join("\n");
    const prompt = `Summarize these B2B sales signals into exactly 3 bullets a sales rep can act on this morning. Be specific (name companies). Max 30 words per bullet.\n\n${summary}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }], max_tokens: 400 }),
    });
    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gateway ${res.status}`);
    }
    const data = await res.json();
    const brief = data?.choices?.[0]?.message?.content?.trim() || "Brief unavailable";
    return new Response(JSON.stringify({ brief, count: signals.length, generated_at: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
