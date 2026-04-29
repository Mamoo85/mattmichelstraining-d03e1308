// Agent 1 (Extractor): Pulls leads from a source document.
// Every claim MUST include source_excerpt + source_offset for downstream verification.
// Uses strict-json (Claude Haiku, tool calling, additionalProperties:false).

import { callStrictJson, StrictJsonError } from "./strict-json.ts";

export interface ExtractedClaim {
  full_name?: string;
  address: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_detail: string;
  signal_date?: string;
  source_excerpt: string;   // verbatim substring of source text the claim came from
  source_offset: number;    // index in source where excerpt begins
}

export interface ExtractorResult {
  claims: ExtractedClaim[];
  extractor_run_id: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          full_name: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          zip: { type: "string" },
          signal_type: { type: "string" },
          signal_detail: { type: "string" },
          signal_date: { type: "string" },
          source_excerpt: { type: "string", minLength: 8 },
          source_offset: { type: "integer", minimum: 0 },
        },
        required: ["address", "signal_type", "signal_detail", "source_excerpt", "source_offset"],
      },
    },
  },
  required: ["claims"],
};

export async function extractLeadsFromSource(args: {
  sourceText: string;
  sourceLabel: string;
  signalTypeHint: string;
  maxClaims?: number;
}): Promise<ExtractorResult> {
  const cap = args.maxClaims ?? 10;
  const truncated = args.sourceText.slice(0, 12_000);
  const runId = crypto.randomUUID();

  try {
    const out = await callStrictJson<{ claims: ExtractedClaim[] }>({
      systemPrompt:
        "You extract structured lead data from PUBLIC RECORDS source text. " +
        "Every claim MUST include source_excerpt: a verbatim substring (>=8 chars) copied EXACTLY from the source. " +
        "source_offset MUST be the integer index where that excerpt begins in the source. " +
        "Do NOT invent addresses, names, or dates. If a field is not in the source, omit it. " +
        "If nothing relevant, return claims:[]. Public sources only — no credit bureau data.",
      userPrompt:
        `Source label: ${args.sourceLabel}\nSignal type hint: ${args.signalTypeHint}\nMax claims: ${cap}\n\n--- SOURCE START ---\n${truncated}\n--- SOURCE END ---`,
      toolName: "report_extracted_claims",
      toolDescription: "Report grounded claims with verbatim source excerpts.",
      toolSchema: SCHEMA,
      maxTokens: 1200,
      temperature: 0.1,
    });
    return { claims: (out.claims || []).slice(0, cap), extractor_run_id: runId };
  } catch (e) {
    if (e instanceof StrictJsonError) {
      console.warn("[lead-extractor]", e.message);
    }
    return { claims: [], extractor_run_id: runId };
  }
}
