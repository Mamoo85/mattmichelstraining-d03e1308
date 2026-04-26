/**
 * Lovable AI Gateway helpers — Haiku for cheap calls, Opus for high-stakes outreach.
 *
 * Opus is wired ONLY for: agency outreach email drafting, candidate-to-agency
 * pitch matching, and sales objection handling. Everything else uses Haiku.
 */

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const OPUS_MODEL = "claude-opus-4-7";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/**
 * High-stakes generation via Claude Opus. Use for outreach drafts only.
 * Falls back to Haiku via Lovable Gateway if Anthropic key missing.
 */
export async function generateWithOpus(prompt: string, system?: string, maxTokens = 1500): Promise<string> {
  if (!ANTHROPIC_KEY) {
    console.warn("[Opus] ANTHROPIC_API_KEY missing — falling back to Haiku via gateway");
    return generateWithHaiku(prompt, system, maxTokens);
  }
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPUS_MODEL,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[Opus] ${res.status}: ${await res.text()}`);
      return generateWithHaiku(prompt, system, maxTokens);
    }
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || "";
  } catch (e) {
    console.error("[Opus] Exception:", e);
    return generateWithHaiku(prompt, system, maxTokens);
  }
}

/** Cheap Haiku via Lovable Gateway. */
export async function generateWithHaiku(prompt: string, system?: string, maxTokens = 1024): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  try {
    const messages: any[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[Haiku/Gateway] ${res.status}: ${await res.text()}`);
      return "";
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("[Haiku/Gateway] Exception:", e);
    return "";
  }
}
