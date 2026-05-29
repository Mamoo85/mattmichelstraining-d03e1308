// pod-reconcile-ghosts — finds pod_product_queue rows where status='published'
// but printify_id IS NULL and failed_permanently=false, then retries them.
// After 3 attempts marks failed_permanently=true and SMS Matt.
// Cron: every 6 hours. Also safe to trigger manually.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://zmyczlfuufhngzovkjdh.supabase.co";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 1. Query ghost records: published but no printify_id, not permanently failed, not digital
    const { data: ghosts, error: queryErr } = await supabase
      .from("pod_product_queue")
      .select("*")
      .eq("status", "published")
      .is("printify_id", null)
      .or("failed_permanently.is.null,failed_permanently.eq.false")
      .neq("product_type", "digital")
      .order("created_at", { ascending: true })
      .limit(20);

    if (queryErr) {
      throw new Error(`Query failed: ${queryErr.message}`);
    }

    if (!ghosts || ghosts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, checked: 0, retried: 0, permaFailed: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    let retriedCount = 0;
    const permaFailures: Array<{ id: string; name: string }> = [];

    for (const item of ghosts) {
      // 2a. Increment publish_attempt_count
      const newAttemptCount = (item.publish_attempt_count ?? 0) + 1;

      await supabase
        .from("pod_product_queue")
        .update({ publish_attempt_count: newAttemptCount })
        .eq("id", item.id);

      // 2b. Check if max retries exceeded
      if (newAttemptCount >= 3) {
        await supabase
          .from("pod_product_queue")
          .update({
            failed_permanently: true,
            last_publish_error: "max retries exceeded",
          })
          .eq("id", item.id);

        permaFailures.push({ id: item.id, name: item.name ?? item.id });
        continue;
      }

      // 2c. Call printify-product-creator with repairProductId
      try {
        const repairRes = await fetch(
          `${SUPABASE_URL}/functions/v1/printify-product-creator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ repairProductId: item.id }),
            signal: AbortSignal.timeout(65_000),
          },
        );

        let repairBody: Record<string, unknown> = {};
        try {
          repairBody = await repairRes.json();
        } catch {
          // ignore parse error
        }

        // 2d. If response has printifyId → update the record
        if (repairBody.printifyId) {
          await supabase
            .from("pod_product_queue")
            .update({
              printify_id: repairBody.printifyId as string,
              last_publish_error: null,
            })
            .eq("id", item.id);

          retriedCount++;
        } else {
          // 2e. Repair attempt failed
          await supabase
            .from("pod_product_queue")
            .update({
              last_publish_error: `repair attempt failed: HTTP ${repairRes.status}`,
            })
            .eq("id", item.id);
        }
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        await supabase
          .from("pod_product_queue")
          .update({ last_publish_error: `repair fetch error: ${msg}` })
          .eq("id", item.id);

        await logError({
          source: "pod-reconcile-ghosts",
          function_name: "pod-reconcile-ghosts",
          severity: "warning",
          error_message: `Repair fetch error for ${item.id}: ${msg}`,
        });
      }
    }

    // 3. SMS Matt if any permanently failed
    if (permaFailures.length > 0) {
      const names = permaFailures
        .map((f) => f.name)
        .slice(0, 5)
        .join(", ");

      await sendSMS(
        ADMIN_PHONE,
        Deno.env.get("TWILIO_PHONE_NUMBER") ?? "",
        `🚨 ${permaFailures.length} ghost POD records hit 3 retries — marked permanently failed. IDs: ${names}`,
        "pod-reconcile-ghosts",
      );
    }

    // 4. Return summary
    return new Response(
      JSON.stringify({
        ok: true,
        checked: ghosts.length,
        retried: retriedCount,
        permaFailed: permaFailures.length,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await logError({
      source: "pod-reconcile-ghosts",
      function_name: "pod-reconcile-ghosts",
      severity: "error",
      error_message: msg,
    });

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
