/**
 * Two-tier LLM response cache (B11–B20).
 *
 *   Tier 1: exact sha256(model_family + content_type + prompt) lookup    ~1ms
 *   Tier 2: pgvector cosine match against prompt_embedding (>=0.92)      ~5–20ms
 *   Miss   : call upstream, embed via Lovable AI Gateway, write back
 *
 * Cache TTL is content-type aware:
 *   - job_posting   : 24h  (volatile)
 *   - company_desc  : 30d  (stable)
 *   - license_meta  : 90d  (very stable)
 *   - generic       : 7d   (default)
 *
 * Negative results (null / "no signal") are also cached, with a shorter 6h TTL,
 * to prevent paying twice for the same dead URL.
 *
 * Models within the same family share cache:
 *   gemini-2.5-flash + gemini-2.5-flash-lite   -> "gemini-flash"
 *   gpt-5-mini                                  -> "gpt-5-mini"     (isolated)
 *   gpt-5 / gemini-2.5-pro                      -> isolated         (premium)
 *
 * Usage:
 *   import { cachedLLM } from "../_shared/llm-cache.ts";
 *   const out = await cachedLLM({
 *     model: "google/gemini-2.5-flash",
 *     prompt,
 *     temperature: 0,
 *     contentType: "company_desc",
 *     caller: "industry-pulse-scanner",
 *   }, async () => callTheModel(...));
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOVABLE_EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/text-embedding-004"; // 768-dim

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _sb;
}

// ── Types ─────────────────────────────────────────────────────────────────

export type ContentType =
  | "job_posting"
  | "company_desc"
  | "license_meta"
  | "candidate_profile"
  | "generic";

export type CacheTier = "exact_hit" | "semantic_hit" | "negative_hit" | "miss";

export interface CacheOpts {
  model: string;
  prompt: string;
  temperature?: number;
  contentType?: ContentType;
  /** Caller name for ai_call_log ROI reporting. */
  caller?: string;
  /** Cosine similarity threshold for semantic hits (0–1). Default 0.92. */
  semanticThreshold?: number;
  /** Disable semantic tier (exact-only). Default false. */
  exactOnly?: boolean;
}

export interface CacheResult<T> {
  data: T;
  tier: CacheTier;
  similarity?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalize a model name to its family. Cheap interchangeable models share
 * cache; premium models stay isolated.
 */
export function modelFamily(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("gemini-2.5-flash") || m.includes("gemini-3-flash")) return "gemini-flash";
  if (m.includes("gemini-2.5-pro") || m.includes("gemini-3.1-pro") || m.includes("gemini-3-pro")) return m;
  if (m.includes("gpt-5-nano")) return "gpt-5-nano";
  if (m.includes("gpt-5-mini")) return "gpt-5-mini";
  if (m.includes("gpt-5")) return m;
  if (m.includes("sonar")) return "sonar";
  return m; // unknown -> isolated
}

function ttlForContent(contentType: ContentType, isNegative: boolean): string {
  if (isNegative) return `${6 * 3600} seconds`;
  switch (contentType) {
    case "job_posting":   return `${24 * 3600} seconds`;        // 24h
    case "company_desc":  return `${30 * 86400} seconds`;       // 30d
    case "license_meta":  return `${90 * 86400} seconds`;       // 90d
    case "candidate_profile": return `${7 * 86400} seconds`;    // 7d
    case "generic":
    default:              return `${7 * 86400} seconds`;        // 7d
  }
}

function isNegativeResult(data: unknown): boolean {
  if (data == null) return true;
  if (typeof data === "string") {
    const s = data.toLowerCase().trim();
    return s === "" || s === "null" || s.startsWith("no signal") || s.startsWith("not found");
  }
  if (Array.isArray(data) && data.length === 0) return true;
  if (typeof data === "object") {
    const v = data as Record<string, unknown>;
    if (Object.keys(v).length === 0) return true;
    if (v.found === false || v.signal === null || v.error) return true;
  }
  return false;
}

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch(LOVABLE_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: text.slice(0, 8000), // safety cap
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const v = json?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

async function logTier(
  caller: string,
  model: string,
  family: string,
  tier: CacheTier,
  ms: number,
) {
  const client = sb();
  if (!client) return;
  try {
    await (client.from as any)("ai_call_log").insert({
      caller,
      task: "llm_cache",
      provider: "cache",
      model,
      success: tier !== "miss",
      latency_ms: ms,
      cost_usd: 0,
      cache_tier: tier,
      error_message: null,
    });
  } catch { /* never block */ }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Two-tier cached LLM call. See module docstring for behavior.
 */
export async function cachedLLM<T>(
  opts: CacheOpts,
  fetchFn: () => Promise<T>,
): Promise<CacheResult<T>> {
  const t0 = Date.now();
  const client = sb();
  const family = modelFamily(opts.model);
  const contentType: ContentType = opts.contentType || "generic";
  const caller = opts.caller || "unknown";
  const threshold = opts.semanticThreshold ?? 0.92;
  const temperature = opts.temperature ?? 0;

  if (!client) {
    return { data: await fetchFn(), tier: "miss" };
  }

  const exactKey = await sha256(`${family}::${contentType}::${temperature}::${opts.prompt}`);

  // ── Tier 1: exact hash hit ──
  try {
    const { data: hit } = await (client.from as any)("llm_response_cache")
      .select("response, hit_count")
      .eq("prompt_hash", exactKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (hit) {
      // fire-and-forget hit_count bump
      (client.from as any)("llm_response_cache")
        .update({
          hit_count: (hit.hit_count || 1) + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq("prompt_hash", exactKey)
        .then(() => {}, () => {});
      const tier: CacheTier = isNegativeResult(hit.response) ? "negative_hit" : "exact_hit";
      logTier(caller, opts.model, family, tier, Date.now() - t0);
      return { data: hit.response as T, tier };
    }
  } catch { /* fall through */ }

  // ── Tier 2: semantic vector hit ──
  let queryEmbedding: number[] | null = null;
  if (!opts.exactOnly && LOVABLE_API_KEY) {
    queryEmbedding = await embed(opts.prompt);
    if (queryEmbedding) {
      try {
        const { data: matches } = await (client.rpc as any)("match_llm_cache", {
          _embedding: queryEmbedding,
          _threshold: threshold,
          _model_family: family,
          _content_type: contentType,
        });
        const m = Array.isArray(matches) ? matches[0] : null;
        if (m?.response) {
          // bump hit count
          (client.from as any)("llm_response_cache")
            .update({
              hit_count: (m.hit_count || 1) + 1,
              last_hit_at: new Date().toISOString(),
            })
            .eq("id", m.id)
            .then(() => {}, () => {});
          const tier: CacheTier = isNegativeResult(m.response) ? "negative_hit" : "semantic_hit";
          logTier(caller, opts.model, family, tier, Date.now() - t0);
          return { data: m.response as T, tier, similarity: m.similarity };
        }
      } catch { /* miss */ }
    }
  }

  // ── Miss: call upstream ──
  const data = await fetchFn();
  const negative = isNegativeResult(data);
  const ttl = ttlForContent(contentType, negative);

  // Embed for future semantic hits if we didn't already
  if (!queryEmbedding && !opts.exactOnly) {
    queryEmbedding = await embed(opts.prompt);
  }

  // Store (fire-and-forget; never block caller on cache write)
  try {
    const expiresAt = new Date(Date.now() + ttlSecondsToMs(ttl)).toISOString();
    await (client.from as any)("llm_response_cache").upsert(
      {
        prompt_hash: exactKey,
        model: opts.model,
        model_family: family,
        content_type: contentType,
        prompt_preview: opts.prompt.slice(0, 240),
        prompt_embedding: queryEmbedding ? toPgVector(queryEmbedding) : null,
        response: data as unknown,
        expires_at: expiresAt,
        hit_count: 0,
      },
      { onConflict: "prompt_hash" },
    );
  } catch { /* ignore */ }

  logTier(caller, opts.model, family, "miss", Date.now() - t0);
  return { data, tier: "miss" };
}

/** Convert "N seconds" interval string to ms for JS Date math. */
function ttlSecondsToMs(interval: string): number {
  const m = interval.match(/(\d+)\s*seconds?/);
  return m ? parseInt(m[1], 10) * 1000 : 7 * 86400 * 1000;
}

/** pgvector accepts the literal string "[v1,v2,...]". */
function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

// ── Back-compat shim for any old callers ──────────────────────────────────
//
// Old signature: cachedLLM(model, prompt, temperature, fetchFn) -> { data, cached }
// New callers use the object-options form above. We keep this overload for safety.
export async function cachedLLMLegacy<T>(
  model: string,
  prompt: string,
  temperature: number,
  fetchFn: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  const r = await cachedLLM<T>({ model, prompt, temperature }, fetchFn);
  return { data: r.data, cached: r.tier !== "miss" };
}
