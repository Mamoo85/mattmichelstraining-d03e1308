// Two-agent extraction + contradiction check for any remaining LLM-assisted enrichment.
// Pattern (per Gemini's review): never trust a single LLM pass. The first agent extracts;
// the second agent independently verifies the claim against the source text. If they
// disagree, we reject. Result: hallucinations get caught before they leave the function.

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GW = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite"; // cheap + fast — we only ask yes/no

export interface ContradictionCheck {
  pass: boolean;
  confidence: number; // 0-1
  reason: string;
}

/**
 * Ask a second model: "Given THIS source text, is the following claim explicitly supported?"
 * The verifier sees ONLY the source text + the claim — it cannot invent.
 */
export async function contradictionCheck(
  sourceText: string,
  claim: string,
): Promise<ContradictionCheck> {
  if (!LOVABLE_API_KEY) {
    // Fail-closed: without a verifier we cannot trust LLM extractions.
    return { pass: false, confidence: 0, reason: "verifier_unavailable" };
  }
  if (!sourceText || sourceText.length < 20) {
    return { pass: false, confidence: 0, reason: "insufficient_source_text" };
  }
  try {
    const trimmed = sourceText.slice(0, 6000);
    const r = await fetch(GW, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are a strict fact-checker. Given SOURCE TEXT and a CLAIM, decide if the claim is EXPLICITLY supported by the source text. Do not infer beyond what is written. Respond ONLY with JSON: {\"supported\": boolean, \"confidence\": 0.0-1.0, \"reason\": \"short reason\"}.",
          },
          {
            role: "user",
            content: `SOURCE TEXT:\n${trimmed}\n\nCLAIM:\n${claim}\n\nIs the claim explicitly supported by the source text?`,
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      return { pass: false, confidence: 0, reason: `verifier_http_${r.status}` };
    }
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || "{}";
    const cleaned = txt.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const supported = Boolean(parsed.supported);
    const confidence = Number(parsed.confidence ?? 0);
    return {
      pass: supported && confidence >= 0.6,
      confidence,
      reason: String(parsed.reason || (supported ? "verified" : "not_supported")),
    };
  } catch (e) {
    return { pass: false, confidence: 0, reason: `verifier_error_${e instanceof Error ? e.message : "unknown"}` };
  }
}
