// DLQ processor — runs hourly, retries due records by re-invoking the
// originating edge function with the stored payload.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: due, error } = await sb
    .from("ingestion_dlq")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let succeeded = 0, retried = 0, dead = 0;

  for (const row of due ?? []) {
    const nextCount = (row.retry_count ?? 0) + 1;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${row.job_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ ...(row.payload || {}), _dlq_retry: true }),
      });
      if (res.ok) {
        await sb.from("ingestion_dlq").update({
          status: "resolved", resolved_at: new Date().toISOString(), retry_count: nextCount,
        }).eq("id", row.id);
        succeeded++;
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isDead = nextCount >= (row.max_retries ?? 5);
      const backoffMin = Math.min(2 ** nextCount, 60);
      await sb.from("ingestion_dlq").update({
        status: isDead ? "dead" : "retrying",
        retry_count: nextCount,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
        error_message: msg.slice(0, 1000),
      }).eq("id", row.id);
      if (isDead) dead++; else retried++;
    }
  }

  // SMS Matt if any went dead
  if (dead > 0) {
    const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE");
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (ADMIN_PHONE && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: TWILIO_FROM, To: ADMIN_PHONE,
            Body: `🚨 DLQ: ${dead} job(s) gave up after max retries. Check /admin/dlq.`,
          }).toString(),
        });
      } catch { /* swallow */ }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: due?.length ?? 0, succeeded, retried, dead }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
