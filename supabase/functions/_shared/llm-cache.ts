/**
 * LLM response cache (#13). Keyed by sha256(model + prompt + temperature).
 * OPT-IN — wrap any LLM call with cachedLLM() to dedupe.
 *
 *   import { cachedLLM } from "../_shared/llm-cache.ts";
 *   const out = await cachedLLM("openai/gpt-5-mini", prompt, 0, async () => {
 *     return await callTheModel(...);
 *   });
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _sb;
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cachedLLM<T>(
  model: string,
  prompt: string,
  temperature: number,
  fetchFn: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  const client = sb();
  if (!client) {
    return { data: await fetchFn(), cached: false };
  }
  const promptHash = await sha256(`${model}::${temperature}::${prompt}`);

  // Try cache
  try {
    const { data: hit } = await (client.from as any)("llm_response_cache")
      .select("response, hit_count")
      .eq("prompt_hash", promptHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (hit) {
      // Fire-and-forget hit_count update
      (client.from as any)("llm_response_cache")
        .update({ hit_count: (hit.hit_count || 1) + 1, last_hit_at: new Date().toISOString() })
        .eq("prompt_hash", promptHash)
        .then(() => {}, () => {});
      return { data: hit.response as T, cached: true };
    }
  } catch { /* cache miss is fine */ }

  // Miss — call upstream
  const data = await fetchFn();

  // Store (fire-and-forget; never block caller on cache write)
  try {
    await (client.from as any)("llm_response_cache").upsert(
      { prompt_hash: promptHash, model, response: data as unknown },
      { onConflict: "prompt_hash" },
    );
  } catch { /* ignore */ }

  return { data, cached: false };
}
