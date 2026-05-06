/**
 * generate-account-narrative
 * Streaming SSE — generates the "WHY this account is hot" AI summary.
 * Caches in account_narratives for 24h. Uses Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CACHE_HOURS = 24;
// Default to Claude Haiku via Anthropic (we already pay for it). Falls back to
// Lovable Gateway if ANTHROPIC_API_KEY is missing.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { account_key, force = false, model = DEFAULT_MODEL } = await req.json();
    if (!account_key) {
      return new Response(JSON.stringify({ error: "account_key required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (!force) {
      const { data: cached } = await sb.from("account_narratives")
        .select("narrative_md, generated_at, pitch_angle, recommended_products")
        .eq("account_key", account_key).maybeSingle();
      if (cached) {
        const ageHr = (Date.now() - new Date(cached.generated_at).getTime()) / 3.6e6;
        if (ageHr < CACHE_HOURS) {
          return new Response(JSON.stringify({ cached: true, ...cached }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: snap } = await sb.from("v_latest_intent_scores")
      .select("*").eq("account_key", account_key).maybeSingle();
    if (!snap) {
      return new Response(JSON.stringify({ error: "account not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signals = (snap.contributing_signals || []) as any[];
    const signalsBrief = signals.slice(0, 8).map((s) =>
      `- ${s.display_label} (${s.category}, ${Math.round(s.age_days)}d ago, decayed value ${s.decayed_value})`
    ).join("\n");

    const sys = `You are a senior B2B sales analyst. You write tight, specific account briefings for sales reps. Never generic — always cite the actual signals. 4 short paragraphs max. Markdown. No fluff.`;
    const user = `Account: ${snap.company_name}
Location: ${snap.location || "unknown"}
Vertical: ${snap.vertical || "unknown"}
Intent score: ${snap.score}/100 (tier: ${snap.tier})
Signal stack: ${snap.category_count} categories, ${snap.signal_count} signals, x${snap.stacking_multiplier} multiplier
Trajectory: ${snap.trajectory_delta_14d ?? "n/a"} pts in last 14d

Recent signals:
${signalsBrief}

Write 4 paragraphs:
1. WHY this account is hot right now (cite the actual signals + the pattern they form)
2. What spend window they're entering and on what (be specific to the signals)
3. Recommended pitch angle and which of our products fits (field service software, missed-call catch, lead generation, web design, hire alerts)
4. Macro context: one sentence on what's happening in their vertical

End with: PITCH_ANGLE: <one short phrase> | PRODUCTS: <comma-separated product names>`;

    // Prefer Anthropic Claude (we already pay for it). Fallback to Lovable
    // Gateway with a Gemini equivalent only if ANTHROPIC_API_KEY missing.
    const useAnthropic = ANTHROPIC_KEY && model.startsWith("claude-");
    const ai = useAnthropic
      ? await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            stream: true,
            system: sys,
            messages: [{ role: "user", content: user }],
          }),
        })
      : await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: sys }, { role: "user", content: user }],
            stream: true,
          }),
        });

    if (!ai.ok) {
      if (ai.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ai.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await ai.text();
      throw new Error(`AI gateway ${ai.status}: ${t}`);
    }

    // Tee the stream: pass through to client AND accumulate for cache write.
    // Anthropic and OpenAI-compatible streams have different shapes; handle both.
    let full = "";
    const passThrough = new TransformStream({
      transform(chunk, ctrl) {
        const text = new TextDecoder().decode(chunk);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            // OpenAI/Gemini gateway: choices[0].delta.content
            const oai = parsed.choices?.[0]?.delta?.content;
            if (oai) full += oai;
            // Anthropic: type='content_block_delta' with delta.text
            const anth = parsed.delta?.text;
            if (anth) full += anth;
          } catch { /* partial */ }
        }
        ctrl.enqueue(chunk);
      },
      async flush() {
        if (full.length < 50) return;
        const pitchMatch = full.match(/PITCH_ANGLE:\s*([^|\n]+)/i);
        const prodMatch = full.match(/PRODUCTS:\s*([^\n]+)/i);
        await sb.from("account_narratives").upsert({
          account_key,
          narrative_md: full,
          generated_at: new Date().toISOString(),
          model,
          pitch_angle: pitchMatch?.[1]?.trim() || null,
          recommended_products: prodMatch?.[1]?.split(",").map((s) => s.trim()).filter(Boolean) || null,
          signals_snapshot_at: snap.computed_at,
        });
      },
    });

    return new Response(ai.body!.pipeThrough(passThrough), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("generate-account-narrative:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
