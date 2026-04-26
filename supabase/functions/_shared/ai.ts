/**
 * Shared AI generation utility — Three-tier failover waterfall.
 * Tier 1: Lovable AI Gateway (LOVABLE_API_KEY)
 * Tier 2: Anthropic direct (ANTHROPIC_API_KEY)
 * Tier 3: OpenAI direct (OPENAI_API_KEY)
 *
 * On any non-200 response or network error, advances to the next tier.
 * Updates service_health table on failures so other functions can short-circuit.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const LOVABLE_MODEL = "google/gemini-2.5-flash-lite";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const OPENAI_MODEL = "gpt-5-nano";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Lazy-init service-health client (skip if env not present, e.g. local tests)
let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _sb;
}

async function recordHealth(serviceName: string, ok: boolean, statusCode?: number, reason?: string) {
  const client = sb();
  if (!client) return;
  try {
    if (ok) {
      await (client.from as any)("service_health").update({
        status: "operational",
        last_success_at: new Date().toISOString(),
        failure_count: 0,
        last_status_code: statusCode || 200,
      }).eq("service_name", serviceName);
    } else {
      // Increment failure count; mark degraded after 3 failures
      const { data: existing } = await (client.from as any)("service_health")
        .select("failure_count")
        .eq("service_name", serviceName)
        .maybeSingle();
      const newCount = (existing?.failure_count || 0) + 1;
      const newStatus = newCount >= 3 ? "degraded" : "operational";
      const disabledUntil = statusCode === 402
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h cooldown on credit exhaustion
        : null;
      await (client.from as any)("service_health").update({
        status: newStatus,
        last_failure_at: new Date().toISOString(),
        failure_count: newCount,
        last_failure_reason: reason?.slice(0, 500) || `HTTP ${statusCode}`,
        last_status_code: statusCode || null,
        ...(disabledUntil ? { disabled_until: disabledUntil } : {}),
      }).eq("service_name", serviceName);
    }
  } catch {
    // Never let health logging break AI calls
  }
}

async function isServiceDisabled(serviceName: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { data } = await (client.from as any)("service_health")
      .select("disabled_until")
      .eq("service_name", serviceName)
      .maybeSingle();
    if (!data?.disabled_until) return false;
    return new Date(data.disabled_until).getTime() > Date.now();
  } catch {
    return false;
  }
}

async function callLovable(prompt: string, maxTokens: number): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  if (await isServiceDisabled("lovable_ai_gateway")) return "";
  try {
    const res = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOVABLE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[AI/Lovable] ${res.status}: ${err.slice(0, 200)}`);
      await recordHealth("lovable_ai_gateway", false, res.status, err.slice(0, 200));
      return "";
    }
    const data = await res.json();
    await recordHealth("lovable_ai_gateway", true, 200);
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("[AI/Lovable] exception:", e);
    await recordHealth("lovable_ai_gateway", false, 0, String(e).slice(0, 200));
    return "";
  }
}

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "";
  if (await isServiceDisabled("anthropic_api")) return "";
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[AI/Anthropic] ${res.status}: ${err.slice(0, 200)}`);
      await recordHealth("anthropic_api", false, res.status, err.slice(0, 200));
      return "";
    }
    const data = await res.json();
    await recordHealth("anthropic_api", true, 200);
    return data?.content?.[0]?.text?.trim() || "";
  } catch (e) {
    console.error("[AI/Anthropic] exception:", e);
    await recordHealth("anthropic_api", false, 0, String(e).slice(0, 200));
    return "";
  }
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  if (await isServiceDisabled("openai_api")) return "";
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_completion_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[AI/OpenAI] ${res.status}: ${err.slice(0, 200)}`);
      await recordHealth("openai_api", false, res.status, err.slice(0, 200));
      return "";
    }
    const data = await res.json();
    await recordHealth("openai_api", true, 200);
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("[AI/OpenAI] exception:", e);
    await recordHealth("openai_api", false, 0, String(e).slice(0, 200));
    return "";
  }
}

/**
 * Three-tier waterfall: Lovable → Anthropic → OpenAI.
 * Returns first successful non-empty response, or "" if all fail.
 */
export async function generateText(
  prompt: string,
  maxTokens = 1024
): Promise<string> {
  const t1 = await callLovable(prompt, maxTokens);
  if (t1) return t1;

  console.warn("[AI] Lovable failed/disabled, falling back to Anthropic");
  const t2 = await callAnthropic(prompt, maxTokens);
  if (t2) return t2;

  console.warn("[AI] Anthropic failed/disabled, falling back to OpenAI");
  const t3 = await callOpenAI(prompt, maxTokens);
  if (t3) return t3;

  console.error("[AI] All three providers failed");
  return "";
}

export async function generateJSON<T>(
  prompt: string,
  fallback: T,
  maxTokens = 1024
): Promise<T> {
  const text = await generateText(prompt + "\n\nRespond with valid JSON only.", maxTokens);
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}
