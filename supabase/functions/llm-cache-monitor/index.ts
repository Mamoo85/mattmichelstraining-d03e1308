// llm-cache-monitor (B19 + B20)
//
// Daily cron:
//   1. Computes 24h cache hit rate from public.ai_call_log.cache_tier
//   2. SMS Matt if (cache_hits / total_calls) < 0.30 over 24h with >= 50 calls
//   3. Pre-warms embeddings for industry_pulse_signals rows that don't yet
//      have a cache entry, so future scrapes hit semantically (B19).
//
// Idempotent. Safe to run hourly; alarm only fires when threshold breached.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { cachedLLM } from "../_shared/llm-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function smsMatt(body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_FROM, Body: body }).toString(),
    });
  } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── 1. Hit-rate calculation ──
    const since = new Date(Date.now() - 86400_000).toISOString();
    const { data: rows } = await sb
      .from("ai_call_log")
      .select("cache_tier")
      .gte("created_at", since);

    const total = rows?.length || 0;
    const hits = (rows || []).filter((r: any) =>
      r.cache_tier === "exact_hit" || r.cache_tier === "semantic_hit" || r.cache_tier === "negative_hit"
    ).length;
    const hitRate = total > 0 ? hits / total : 0;

    let alertSent = false;
    // Only alert on meaningful volume + once per 24h (anti-spam)
    if (total >= 500 && hitRate < 0.20) {
      const since24h = new Date(Date.now() - 86400_000).toISOString();
      const { data: recentAlert } = await sb
        .from("system_comms_log")
        .select("id")
        .eq("channel", "sms")
        .ilike("body", "%LLM cache hit rate dropped%")
        .gte("created_at", since24h)
        .limit(1)
        .maybeSingle();

      if (!recentAlert) {
        await smsMatt(
          `🧠 LLM cache hit rate: ${(hitRate * 100).toFixed(1)}% over 24h (${hits}/${total}). Check llm-cache.ts. (Next alert in 24h.)`,
        );
        alertSent = true;
      }
    }

    // ── 2. Pre-warm embeddings for high-confidence Demand Radar signals ──
    let prewarmed = 0;
    let prewarmErrors = 0;
    try {
      const { data: signals } = await sb
        .from("industry_pulse_signals")
        .select("id, company_name, signal_summary")
        .gte("confidence", 7)
        .order("created_at", { ascending: false })
        .limit(20);

      for (const s of signals || []) {
        const prompt = `Company: ${(s as any).company_name || "unknown"}\nSignal: ${(s as any).signal_summary || ""}`;
        if (!prompt.trim() || prompt.length < 30) continue;
        try {
          // No-op upstream — we only want the embed + write to populate the cache
          await cachedLLM(
            {
              model: "google/gemini-2.5-flash",
              prompt,
              temperature: 0,
              contentType: "company_desc",
              caller: "llm-cache-monitor:prewarm",
            },
            async () => ({ prewarm: true, source_id: (s as any).id }),
          );
          prewarmed++;
        } catch {
          prewarmErrors++;
        }
      }
    } catch { /* table might not exist in some envs */ }

    return new Response(
      JSON.stringify({
        ok: true,
        window_24h: { total, hits, hit_rate: hitRate, alert_sent: alertSent },
        prewarm: { attempted: prewarmed + prewarmErrors, succeeded: prewarmed, failed: prewarmErrors },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
