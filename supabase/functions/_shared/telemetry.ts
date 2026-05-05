// Shared telemetry helper — wraps cron-invoked job handlers and records every run.
// Usage:
//   import { withTelemetry } from "../_shared/telemetry.ts";
//   await withTelemetry("my-cron-job", async () => { /* work */ return { ok: true }; });
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export interface TelemetryOptions {
  jobType?: string;
  metadata?: Record<string, unknown>;
}

export async function withTelemetry<T>(
  jobName: string,
  fn: () => Promise<T>,
  opts: TelemetryOptions = {}
): Promise<T> {
  const sb = admin();
  const startedAt = new Date();
  let runId: string | null = null;

  try {
    const { data } = await sb
      .from("system_telemetry")
      .insert({
        job_name: jobName,
        job_type: opts.jobType ?? "edge_function",
        status: "running",
        started_at: startedAt.toISOString(),
        metadata: opts.metadata ?? {},
      })
      .select("id")
      .single();
    runId = data?.id ?? null;
  } catch (_e) {
    // Telemetry insert must never block the job.
  }

  try {
    const result = await fn();
    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();
    if (runId) {
      await sb
        .from("system_telemetry")
        .update({
          status: "success",
          finished_at: finishedAt.toISOString(),
          duration_ms: duration,
          result: safeResult(result),
        })
        .eq("id", runId)
        .then(() => {}, () => {});
    }
    return result;
  } catch (err) {
    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();
    const e = err as Error;
    if (runId) {
      await sb
        .from("system_telemetry")
        .update({
          status: "failed",
          finished_at: finishedAt.toISOString(),
          duration_ms: duration,
          error_message: e?.message ?? String(err),
          error_stack: e?.stack ?? null,
        })
        .eq("id", runId)
        .then(() => {}, () => {});
    }
    throw err;
  }
}

function safeResult(r: unknown): Record<string, unknown> | null {
  try {
    if (r == null) return null;
    if (typeof r !== "object") return { value: r as unknown };
    const json = JSON.parse(JSON.stringify(r));
    const s = JSON.stringify(json);
    if (s.length > 8000) return { truncated: true, preview: s.slice(0, 4000) };
    return json;
  } catch {
    return null;
  }
}
