// Strict-JSON helper: forces Anthropic Claude Haiku tool-calling for constrained, low-temp extraction.
// Zero free-form text. Every scanner LLM call must go through this.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

export interface StrictJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>; // JSON schema (object), additionalProperties:false enforced
  maxTokens?: number;
  temperature?: number; // default 0.1
  timeoutMs?: number;
}

export class StrictJsonError extends Error {
  constructor(public stage: string, message: string, public detail?: unknown) {
    super(`[strict-json:${stage}] ${message}`);
  }
}

/**
 * Calls Claude Haiku with constrained tool-calling. Returns the parsed tool input as T.
 * Throws StrictJsonError on any failure (no silent null returns — caller decides).
 */
export async function callStrictJson<T>(opts: StrictJsonOptions): Promise<T> {
  if (!ANTHROPIC_API_KEY) {
    throw new StrictJsonError("config", "ANTHROPIC_API_KEY not configured");
  }

  // Belt: enforce additionalProperties:false on the root schema so the model can't add fields.
  const schema = { ...opts.toolSchema };
  if (typeof schema === "object" && schema && (schema as any).type === "object" && (schema as any).additionalProperties !== false) {
    (schema as any).additionalProperties = false;
  }

  const body = {
    model: HAIKU_MODEL,
    max_tokens: opts.maxTokens ?? 800,
    temperature: opts.temperature ?? 0.1,
    system: opts.systemPrompt,
    tools: [{
      name: opts.toolName,
      description: opts.toolDescription,
      input_schema: schema,
    }],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.userPrompt }],
  };

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
  } catch (e) {
    throw new StrictJsonError("network", e instanceof Error ? e.message : String(e));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new StrictJsonError("http_" + res.status, text.slice(0, 500));
  }

  const j = await res.json();
  const block = (j?.content || []).find((c: any) => c.type === "tool_use");
  if (!block || !block.input) {
    throw new StrictJsonError("no_tool_use", "Model did not return tool_use block", j);
  }
  return block.input as T;
}

/**
 * Hard guard: throw if a model identifier looks like a Gemini/Google route.
 * Use in scanner code paths to prevent regression.
 */
export function assertAnthropicOnly(model: string, callerHint: string): void {
  if (model.startsWith("google/") || model.includes("gemini")) {
    throw new Error(`[anthropic-only-violation] caller=${callerHint} attempted model=${model}. Use callStrictJson() with claude-haiku-4-5-20251001.`);
  }
}
