/**
 * Shared cheap-extraction helper for high-volume, low-complexity LLM tasks.
 *
 * Use this for: name parsing, address normalization, person-vs-company classification,
 * contact field cleanup, simple record extraction. NOT for: OSINT search, dossier
 * synthesis, anything needing citations or nuanced multi-step reasoning.
 *
 * Default tier 1: Lovable AI Gateway @ google/gemini-2.5-flash-lite (free-tier eligible)
 * Tier 2 fallback: OpenRouter @ google/gemini-2.5-flash-lite (paid, same model)
 *
 * Always logs to public.ai_call_log for ROI measurement.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cachedLLM, type ContentType } from "./llm-cache.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CHEAP_MODEL = "google/gemini-2.5-flash-lite";

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _sb;
}

export type ExtractTask =
  | "name_parse"
  | "address_parse"
  | "person_vs_company"
  | "contact_normalize"
  | "simple_record_extract"
  | "summary_short"
  | "classify";

interface CheapOpts {
  task: ExtractTask;
  /** JSON Schema describing the desired output shape. Used as a tool-call parameter. */
  schema: Record<string, unknown>;
  /** Optional system prompt; sensible default applied otherwise. */
  system?: string;
  /** Max tokens; keep small — these are extraction tasks, not generation. */
  maxTokens?: number;
  /** Caller name for ROI logs (e.g. "candidate-deep-enrich"). */
  caller?: string;
  /** Content type for cache TTL/segmentation. Defaults to "generic". */
  contentType?: ContentType;
  /** Skip the semantic LLM cache (default false — cache is on). */
  noCache?: boolean;
}

interface CheapResult<T> {
  ok: boolean;
  data: T | null;
  provider: "lovable" | "openrouter" | "none";
  ms: number;
  error?: string;
}

async function logCall(
  caller: string,
  task: string,
  provider: string,
  model: string,
  ok: boolean,
  ms: number,
  error?: string,
) {
  const client = sb();
  if (!client) return;
  try {
    await (client.from as any)("ai_call_log").insert({
      caller, task, provider, model, success: ok, latency_ms: ms,
      error_message: error?.slice(0, 500) || null,
    });
  } catch { /* never break callers on logging */ }
}

function buildTool(task: ExtractTask, schema: Record<string, unknown>) {
  return [{
    type: "function",
    function: {
      name: `extract_${task}`,
      description: `Extract structured ${task.replace(/_/g, " ")} data from the user's input.`,
      parameters: schema,
    },
  }];
}

async function callProvider(
  url: string,
  apiKey: string,
  prompt: string,
  opts: CheapOpts,
): Promise<{ ok: boolean; data: any; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHEAP_MODEL,
      max_tokens: opts.maxTokens ?? 400,
      messages: [
        {
          role: "system",
          content: opts.system ||
            "You are a precise data-extraction tool. Use the provided function to return structured output. Never invent data — use null for missing fields.",
        },
        { role: "user", content: prompt },
      ],
      tools: buildTool(opts.task, opts.schema),
      tool_choice: { type: "function", function: { name: `extract_${opts.task}` } },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, data: null, error: `${res.status}: ${t.slice(0, 200)}` };
  }

  const data = await res.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return { ok: true, data: JSON.parse(toolCall.function.arguments) };
    } catch (e) {
      return { ok: false, data: null, error: `parse: ${e}` };
    }
  }
  // Fallback: model returned plain content (some providers don't honor tool_choice strictly)
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { return { ok: true, data: JSON.parse(m[0]) }; } catch { /* fall through */ }
    }
  }
  return { ok: false, data: null, error: "no tool_call or parseable content" };
}

/**
 * Extract structured data from a prompt using the cheap model with tool-calling.
 * Tries Lovable AI Gateway first, then OpenRouter as paid fallback.
 *
 * Wrapped in cachedLLM() — exact + semantic cache (B17). Pass `noCache: true` to bypass.
 */
export async function cheapExtract<T = Record<string, unknown>>(
  prompt: string,
  opts: CheapOpts,
): Promise<CheapResult<T>> {
  const caller = opts.caller || "unknown";

  const inner = async (): Promise<CheapResult<T>> => {
    const t0 = Date.now();

    // Tier 1: Lovable AI Gateway (free-tier eligible)
    if (LOVABLE_API_KEY) {
      try {
        const r = await callProvider(LOVABLE_URL, LOVABLE_API_KEY, prompt, opts);
        const ms = Date.now() - t0;
        if (r.ok) {
          await logCall(caller, opts.task, "lovable", CHEAP_MODEL, true, ms);
          return { ok: true, data: r.data as T, provider: "lovable", ms };
        }
        await logCall(caller, opts.task, "lovable", CHEAP_MODEL, false, ms, r.error);
      } catch (e) {
        await logCall(caller, opts.task, "lovable", CHEAP_MODEL, false, Date.now() - t0, String(e).slice(0, 200));
      }
    }

    // Tier 2: OpenRouter (paid fallback)
    if (OPENROUTER_API_KEY) {
      const t1 = Date.now();
      try {
        const r = await callProvider(OPENROUTER_URL, OPENROUTER_API_KEY, prompt, opts);
        const ms = Date.now() - t1;
        if (r.ok) {
          await logCall(caller, opts.task, "openrouter", CHEAP_MODEL, true, ms);
          return { ok: true, data: r.data as T, provider: "openrouter", ms };
        }
        await logCall(caller, opts.task, "openrouter", CHEAP_MODEL, false, ms, r.error);
      } catch (e) {
        await logCall(caller, opts.task, "openrouter", CHEAP_MODEL, false, Date.now() - t1, String(e).slice(0, 200));
      }
    }

    return { ok: false, data: null, provider: "none", ms: Date.now() - t0, error: "all providers failed" };
  };

  if (opts.noCache) return inner();

  // Always-cached wrapper (B17). Cache key includes the task + schema shape so
  // different schemas don't collide on the same prompt.
  const cacheKey = `task=${opts.task}\nschema=${JSON.stringify(opts.schema)}\nprompt=${prompt}`;
  const cached = await cachedLLM<CheapResult<T>>(
    {
      model: CHEAP_MODEL,
      prompt: cacheKey,
      temperature: 0,
      contentType: opts.contentType || "generic",
      caller,
    },
    inner,
  );
  return cached.data;
}

// Convenience schemas for the most common tasks.
export const Schemas = {
  address: {
    type: "object",
    properties: {
      address_line1: { type: ["string", "null"], description: "Street number and name only" },
      city: { type: ["string", "null"] },
      state: { type: ["string", "null"], description: "2-letter US state code" },
      zip: { type: ["string", "null"], description: "5-digit ZIP" },
      phone: { type: ["string", "null"], description: "(XXX) XXX-XXXX format" },
      owner_name: { type: ["string", "null"] },
    },
    required: ["address_line1", "city", "state", "zip"],
    additionalProperties: false,
  },
  name: {
    type: "object",
    properties: {
      first_name: { type: ["string", "null"] },
      last_name: { type: ["string", "null"] },
      middle_name: { type: ["string", "null"] },
      suffix: { type: ["string", "null"] },
      is_person: { type: "boolean", description: "False if input looks like a company, not a person" },
    },
    required: ["first_name", "last_name", "is_person"],
    additionalProperties: false,
  },
  candidateSummary: {
    type: "object",
    properties: {
      qualifications_summary: { type: "string", description: "1-2 sentence qualification overview" },
      hiring_recommendation: { type: "string", description: "Brief hire/skip recommendation with reason" },
    },
    required: ["qualifications_summary", "hiring_recommendation"],
    additionalProperties: false,
  },
} as const;
