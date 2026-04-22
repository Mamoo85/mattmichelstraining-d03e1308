import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// DISABLED 2026-04-22 — we no longer cold-text scraped contractor phone numbers.
// TCPA exposure + low conversion. Email outreach (web-design-drip) covers this lane.
// SMS now reserved for opted-in customers (paying clients, inbound replies, manual sends).
//
// Cron `contractor-sms-daily` was unscheduled in migration 20260422XXXXXX.
// This handler is left as a no-op so any stale invocations return cleanly.

serve(async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      disabled: true,
      reason: "Cold-SMS to scraped contractors disabled — TCPA/policy. Use email outreach instead.",
      sent: 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
