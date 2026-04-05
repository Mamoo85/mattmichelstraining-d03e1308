/**
 * Shared Claude Haiku AI generation utility.
 * Drop-in replacement for Lovable's AI gateway — uses ANTHROPIC_API_KEY directly.
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = "claude-haiku-4-5-20251001";

export async function generateText(
  prompt: string,
  maxTokens = 1024
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.error("[AI] ANTHROPIC_API_KEY not set");
    return "";
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[AI] Anthropic error: ${err}`);
      return "";
    }

    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || "";
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
