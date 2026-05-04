// Dead-letter queue helper with exponential backoff.
// Use enqueueDLQ() when a job fails after in-process retries; the dlq-processor
// cron will retry it later until max_retries, then mark dead and SMS Matt.

export interface DLQRecord {
  job_name: string;
  payload: Record<string, unknown>;
  error_message: string;
  retry_count?: number;
  max_retries?: number;
}

export async function enqueueDLQ(sb: any, rec: DLQRecord): Promise<void> {
  const retry = rec.retry_count ?? 0;
  const maxRetries = rec.max_retries ?? 5;
  // Exponential: 2^retry minutes (1, 2, 4, 8, 16…)
  const backoffMs = Math.min(2 ** retry, 60) * 60_000;
  const nextRetry = new Date(Date.now() + backoffMs).toISOString();
  await sb.from("ingestion_dlq").insert({
    job_name: rec.job_name,
    payload: rec.payload,
    error_message: rec.error_message?.slice(0, 1000),
    retry_count: retry,
    max_retries: maxRetries,
    next_retry_at: nextRetry,
    status: retry >= maxRetries ? "dead" : "pending",
    last_attempt_at: new Date().toISOString(),
  });
}

/** Wrap any async function with DLQ-on-failure semantics. */
export async function withDLQ<T>(
  sb: any,
  jobName: string,
  payload: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await enqueueDLQ(sb, { job_name: jobName, payload, error_message: msg }).catch(() => {});
    console.error(`[DLQ] ${jobName} failed: ${msg}`);
    return null;
  }
}
