// Universal enrichment audit logger
// Wraps any provider call so failures are NEVER silent.
// Writes one row to lead_enrichment_audit per call (success or failure).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type Vertical =
  | "mortgage" | "talent" | "demand" | "supply" | "growth"
  | "contractor" | "prospect" | "visitor" | "other";

export type Stage =
  | "free" | "paid" | "gov" | "equity" | "deep"
  | "score" | "summarize" | "verify" | "other";

export type TriggeredBy =
  | "cron" | "webhook" | "manual" | "on_demand" | "buyer_view" | "system";

export interface AuditOpts {
  lead_id: string;
  vertical: Vertical;
  function_name: string;
  stage: Stage;
  provider: string;
  triggered_by?: TriggeredBy;
  actor?: string;
  cost_cents?: number;
}

export interface AuditResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  http_status?: number;
}

/**
 * logEnrichment — run an async provider call inside an audit envelope.
 * Always writes one row to lead_enrichment_audit, regardless of success/failure.
 * Returns the wrapped result so the caller can keep its existing logic.
 */
export async function logEnrichment<T>(
  opts: AuditOpts,
  fn: () => Promise<{
    data?: T;
    fields_added?: string[];
    http_status?: number;
    raw?: unknown;
  }>,
): Promise<AuditResult<T>> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const started_at = new Date();
  let success = false;
  let http_status: number | undefined;
  let error_code: string | undefined;
  let error_message: string | undefined;
  let fields_added: string[] = [];
  let raw_response: unknown = null;
  let data: T | undefined;

  try {
    const result = await fn();
    data = result.data;
    fields_added = result.fields_added || [];
    http_status = result.http_status;
    raw_response = result.raw ?? null;
    success = true;
  } catch (e: any) {
    success = false;
    error_message = (e?.message || String(e)).slice(0, 1000);
    error_code = e?.code || e?.name || null;
    http_status = e?.status || e?.http_status;
  } finally {
    const finished_at = new Date();
    const duration_ms = finished_at.getTime() - started_at.getTime();
    // Fire-and-await but never throw to caller
    try {
      await sb.from("lead_enrichment_audit").insert({
        lead_id: opts.lead_id,
        vertical: opts.vertical,
        function_name: opts.function_name,
        stage: opts.stage,
        provider: opts.provider,
        started_at: started_at.toISOString(),
        finished_at: finished_at.toISOString(),
        duration_ms,
        success,
        http_status: http_status ?? null,
        error_code: error_code ?? null,
        error_message: error_message ?? null,
        fields_added,
        cost_cents: opts.cost_cents ?? 0,
        raw_response: raw_response ?? null,
        triggered_by: opts.triggered_by || "system",
        actor: opts.actor || null,
      });
    } catch (logErr) {
      // Last resort: console — never silent
      console.error("[enrichment-audit] failed to log row", logErr);
    }
  }

  return {
    ok: success,
    data,
    error: error_message,
    http_status,
  };
}
