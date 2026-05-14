// OpenRouter helper — exposes any model on openrouter.ai.
// Used by buyer-pool OSINT discovery + waterfall Tier 110.
//
// Models we use:
//   perplexity/sonar-pro              — fast web-search answers ($0.005/cand range)
//   perplexity/sonar-reasoning-pro    — slower, deeper reasoning + web
//   openai/gpt-5-mini                 — cheap structured output
//   google/gemini-2.5-pro             — long context fallback
//   anthropic/claude-haiku-4.5        — cheap classification
//
// All calls fail-OPEN: return null on any error. Caller decides what to do.

const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// ---------------------------------------------------------------------------
// Daily spend cap — HARD CAP at $5/day per Matt's explicit budget.
// Override via env OPENROUTER_DAILY_CAP_USD (numeric, dollars).
// Spend tracked in public.openrouter_daily_spend; gate is fail-CLOSED on
// over-cap and fail-OPEN on infra error (so a Supabase outage doesn't kill
// every scanner — but if the ledger says we're over, we BLOCK).
// ---------------------------------------------------------------------------
const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPA_SRK =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SERVICE_ROLE_KEY") || "";

function dailyCapUsd(): number {
  const override = Number(Deno.env.get("OPENROUTER_DAILY_CAP_USD") || "");
  if (Number.isFinite(override) && override > 0) return override;
  return 5; // hard cap
}

// Conservative estimated cost reserved BEFORE we make the call — prevents the
// race where 100 parallel callers each see "spent < cap" and all fire.
const PRE_RESERVE_USD = 0.01;

async function rpc(fn: string, body: Record<string, unknown> = {}): Promise<any> {
  if (!SUPA_URL || !SUPA_SRK) return null;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPA_SRK,
        Authorization: `Bearer ${SUPA_SRK}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

async function todaysSpend(): Promise<number> {
  const v = await rpc("openrouter_today_spend");
  return Number(v) || 0;
}

async function recordSpend(costUsd: number): Promise<void> {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return;
  await rpc("openrouter_record_spend", { _cost: costUsd });
}

export type OpenRouterModel =
  | "perplexity/sonar-pro"
  | "perplexity/sonar-reasoning-pro"
  | "openai/gpt-5-mini"
  | "openai/gpt-5-nano"
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "anthropic/claude-haiku-4.5";

export interface OpenRouterCallOpts {
  model: OpenRouterModel;
  system?: string;
  user: string;
  json?: boolean;
  max_tokens?: number;
  timeout_ms?: number;
}

export interface OpenRouterResult {
  text: string;
  raw?: any;
  cost_usd?: number;
}

export async function openrouterCall(opts: OpenRouterCallOpts): Promise<OpenRouterResult | null> {
  if (!OPENROUTER_KEY) return null;

  // Daily cost gate — fail-CLOSED on over-cap. Reserve a tiny pre-charge so
  // parallel callers can't all sneak under the line at once.
  let reserved = false;
  try {
    const cap = dailyCapUsd();
    const newTotal = await rpc("openrouter_record_spend", { _cost: PRE_RESERVE_USD });
    if (typeof newTotal === "number" && Number.isFinite(newTotal)) {
      reserved = true;
      if (newTotal > cap) {
        // Mark blocked, refund the reservation, and bail.
        await rpc("openrouter_record_blocked").catch(() => {});
        await rpc("openrouter_record_spend", { _cost: -PRE_RESERVE_USD }).catch(() => {});
        console.warn(
          `openrouter daily cap reached: $${newTotal.toFixed(2)} > $${cap} — blocking ${opts.model}`,
        );
        return null;
      }
    }
  } catch (e) {
    console.warn("openrouter cap check failed (fail-open)", String((e as any)?.message ?? e));
  }

  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });
  const body: any = {
    model: opts.model,
    messages,
    max_tokens: opts.max_tokens ?? 1200,
  };
  // Perplexity rejects json_object format; only OpenAI/Anthropic/Google accept it.
  if (opts.json && !opts.model.startsWith("perplexity/")) {
    body.response_format = { type: "json_object" };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout_ms ?? 25000);
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagent.com",
        "X-Title": "DWA Buyer Pool OSINT",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.warn(`openrouter ${opts.model} ${r.status}`, await r.text().catch(() => ""));
      return null;
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    const cost = Number(data?.usage?.cost ?? data?.usage?.total_cost ?? 0) || undefined;
    if (cost && cost > 0) {
      // Fire-and-forget — never block the response on the ledger.
      recordSpend(cost).catch(() => {});
    }
    return { text, raw: data, cost_usd: cost };
  } catch (e) {
    console.warn(`openrouter ${opts.model} error`, String((e as any)?.message ?? e));
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Convenience: ask Sonar for a structured JSON list and parse safely.
export async function sonarJsonList(
  prompt: string,
  model: OpenRouterModel = "perplexity/sonar-pro",
): Promise<any[] | null> {
  const r = await openrouterCall({
    model,
    system:
      "You are a B2B data researcher. Reply ONLY with valid JSON. No prose, no markdown fences, no commentary.",
    user: prompt,
    json: true,
    max_tokens: 1800,
  });
  if (!r?.text) return null;
  try {
    // Strip markdown fences if any model adds them anyway
    const cleaned = r.text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.results)) return parsed.results;
    if (Array.isArray(parsed?.companies)) return parsed.companies;
    if (Array.isArray(parsed?.data)) return parsed.data;
    // Single object → wrap
    return [parsed];
  } catch {
    return null;
  }
}
