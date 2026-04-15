/**
 * Shared AI generation utility — Lovable AI Gateway.
 * Uses LOVABLE_API_KEY (auto-provisioned) to call the gateway.
 */

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

export async function generateText(
  prompt: string,
  maxTokens = 1024
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    console.error("[AI] LOVABLE_API_KEY not set");
    return "";
  }

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[AI] Gateway error ${res.status}: ${err}`);
      return "";
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("[AI] Exception:", e);
    return "";
  }
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
