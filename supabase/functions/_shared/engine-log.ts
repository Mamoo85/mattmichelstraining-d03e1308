// Shared telemetry helper for Automated Systems / Ingestion Pipelines.
// Writes start + finish footprints to public.engine_logs. Never throws —
// telemetry must not break the pipeline it observes.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

function client() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

export interface EngineRunHandle {
  runId: string;
  pipeline: string;
  complete: (
    recordsProcessed?: number,
    opts?: { recordsFailed?: number; metadata?: Record<string, unknown>; partial?: boolean },
  ) => Promise<void>;
  fail: (error: unknown, metadata?: Record<string, unknown>) => Promise<void>;
}

/**
 * Begin a tracked Ingestion Pipeline run. Always returns a handle even
 * if the database insert fails — failed telemetry must never block work.
 */
export async function startRun(pipeline: string, metadata?: Record<string, unknown>): Promise<EngineRunHandle> {
  const startedAt = Date.now();
  const sb = client();
  let runId = crypto.randomUUID();

  if (sb) {
    try {
      const { data } = await (sb as any)
        .from("engine_logs")
        .insert({
          pipeline,
          run_id: runId,
          status: "started",
          metadata: metadata ?? null,
        })
        .select("run_id")
        .single();
      if (data?.run_id) runId = data.run_id;
    } catch (e) {
      console.warn(`[engine-log] startRun(${pipeline}) insert failed:`, e);
    }
  }

  const finalize = async (patch: Record<string, unknown>) => {
    if (!sb) return;
    try {
      await (sb as any)
        .from("engine_logs")
        .update({
          ...patch,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq("run_id", runId);
    } catch (e) {
      console.warn(`[engine-log] finalize(${pipeline}) failed:`, e);
    }
  };

  return {
    runId,
    pipeline,
    complete: async (recordsProcessed = 0, opts) => {
      await finalize({
        status: opts?.partial ? "partial" : "success",
        records_processed: recordsProcessed,
        records_failed: opts?.recordsFailed ?? 0,
        metadata: opts?.metadata ?? metadata ?? null,
      });
    },
    fail: async (error, meta) => {
      const msg = error instanceof Error ? error.message : String(error);
      await finalize({
        status: "failed",
        error_message: msg.slice(0, 2000),
        metadata: meta ?? metadata ?? null,
      });
    },
  };
}
