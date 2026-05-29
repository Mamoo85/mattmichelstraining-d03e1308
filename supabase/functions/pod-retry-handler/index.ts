// pod-retry-handler — Dead Letter Queue auto-recovery (#17)
// Cron: every 2 hours via pg_cron
//
// Resets error'd queue rows (up to 3 attempts) back to pending.
// After 3 failures, marks the row dead=true and excludes it from retries.
// Transient failures (Printify 503, DALL-E rate limit, timeouts) are auto-healed.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-RETRY-HANDLER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const retryThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

    // Find rows eligible for retry: status=error, <3 attempts, not dead, last attempt >30min ago
    const { data: retryable, error: fetchErr } = await sb
      .from("pod_product_queue")
      .select("id, name, product_type, error_count, error_msg")
      .eq("status", "error")
      .eq("dead", false)
      .lt("error_count", 3)
      .or(`last_attempted_at.is.null,last_attempted_at.lt.${retryThreshold}`)
      .limit(5);

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

    const toRetry = retryable ?? [];
    log("Retryable rows found", { count: toRetry.length });

    const retried: string[] = [];
    const killed: string[] = [];

    for (const row of toRetry) {
      const newCount = (row.error_count ?? 0) + 1;

      if (newCount >= 3) {
        // Third attempt already happened — mark dead
        await sb.from("pod_product_queue").update({
          dead: true,
          error_msg: `[DEAD after 3 attempts] ${row.error_msg ?? ""}`.slice(0, 500),
          last_attempted_at: new Date().toISOString(),
        }).eq("id", row.id);
        killed.push(`${row.name.slice(0, 40)} (id=${row.id})`);
        log("Marked dead", { id: row.id, name: row.name.slice(0, 40) });
      } else {
        // Reset to pending for retry
        await sb.from("pod_product_queue").update({
          status: "pending",
          error_count: newCount,
          last_attempted_at: new Date().toISOString(),
        }).eq("id", row.id);
        retried.push(`${row.name.slice(0, 40)} (attempt ${newCount})`);
        log("Reset to pending", { id: row.id, name: row.name.slice(0, 40), attempt: newCount });
      }
    }

    // Also report current dead count for monitoring
    const { count: deadCount } = await sb
      .from("pod_product_queue")
      .select("id", { count: "exact", head: true })
      .eq("dead", true);

    return new Response(JSON.stringify({
      success: true,
      retried: retried.length,
      killed: killed.length,
      retriedItems: retried,
      killedItems: killed,
      totalDead: deadCount ?? 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[POD-RETRY-HANDLER] Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
