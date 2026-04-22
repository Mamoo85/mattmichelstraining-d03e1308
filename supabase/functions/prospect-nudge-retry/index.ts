// prospect-nudge-retry — Cron-triggered every 30 min.
//
// Retries prospect nudges where Twilio confirmed undelivered/failed.
// FOUR layers of duplicate prevention:
//   1. Terminal-status gate — only retries when last_nudge_status IN ('undelivered','failed')
//   2. 24h log dedup — skips if system_comms_log shows a sent/delivered to the same phone in last 24h
//   3. Per-prospect advisory lock — blocks concurrent cron overlap
//   4. Hard cap of 2 retries (nudge_retry_count < 2)
//
// After 2 failed retries → marks prospect_nudges.status='dead_undeliverable' + SMSes Matt.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const NUDGE_TEMPLATE = (trackedUrl: string, city: string | null, trade: string | null) => {
  const where = city ? ` in ${city}` : "";
  const what = trade ? ` ${trade} ` : " ";
  return `Hey — Matt with Detroit Web Agency. We send exclusive${what}leads to contractors${where} (no shared leads, no contracts). Quick look: ${trackedUrl} — reply STOP to opt out.`;
};

// Note: We use an optimistic claim (incrementing nudge_retry_count BEFORE sending,
// only proceeding if the increment matched the expected previous count) instead of
// a Postgres advisory lock — this works without exposing pg_advisory_lock RPCs.

serve(async (_req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing creds" }), { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Find retry candidates
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: candidates, error } = await sb
    .from("prospect_nudges")
    .select("id, phone, city, trade, link_token, nudge_retry_count, nudge_sent_at, last_nudge_status, status")
    .in("last_nudge_status", ["undelivered", "failed"])
    .lt("nudge_retry_count", 2)
    .lt("nudge_sent_at", cutoff)
    .neq("status", "dead_undeliverable")
    .neq("status", "dead")
    .neq("status", "converted")
    .limit(50);

  if (error) {
    console.error("[prospect-nudge-retry] query error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ retried: 0, skipped: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let retried = 0;
  let skippedDedup = 0;
  let skippedClaim = 0;
  let markedDead = 0;

  for (const p of candidates) {
    const expectedRetry = p.nudge_retry_count ?? 0;
    const newRetryCount = expectedRetry + 1;

    // 2. Optimistic claim — only one cron run can win this row.
    //    The .eq("nudge_retry_count", expectedRetry) makes the UPDATE a no-op
    //    if another concurrent run already incremented the counter.
    const { data: claimed, error: claimErr } = await sb
      .from("prospect_nudges")
      .update({ nudge_retry_count: newRetryCount })
      .eq("id", p.id)
      .eq("nudge_retry_count", expectedRetry)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      skippedClaim++;
      continue;
    }

    // 3. 24h dedup against system_comms_log — skip if a sent/delivered exists for this phone
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { data: recentSent } = await sb
      .from("system_comms_log")
      .select("id, status, twilio_status")
      .eq("recipient", p.phone)
      .eq("product", "dwa_prospect_nudge")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    const hasFreshSuccess = (recentSent ?? []).some(
      (r: any) => r.status === "sent" || r.twilio_status === "delivered" || r.twilio_status === "sent"
    );
    if (hasFreshSuccess) {
      skippedDedup++;
      await sb
        .from("prospect_nudges")
        .update({ last_nudge_status: "delivered" })
        .eq("id", p.id);
      continue;
    }

    // 4. Re-send via Twilio (with StatusCallback)
    const trackedUrl = `https://detroitwebagent.com/r/${p.link_token}`;
    const body = NUDGE_TEMPLATE(trackedUrl, p.city, p.trade);
    const statusCallback = `${SUPABASE_URL}/functions/v1/prospect-nudge-status-callback`;

    const result = await sendSMS(
      p.phone,
      TWILIO_PHONE_NUMBER,
      body,
      "dwa_prospect_nudge",
      false,
      { bypassQuietHours: false, statusCallback }
    );

    if (result.success && result.sid) {
      await sb
        .from("prospect_nudges")
        .update({
          last_nudge_sid: result.sid,
          last_nudge_status: "queued",
          last_nudge_error: null,
          nudge_sent_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      retried++;
    } else if (result.skipped) {
      // Quiet hours / opt-out — roll back the claim so next cron tries again.
      await sb
        .from("prospect_nudges")
        .update({ nudge_retry_count: expectedRetry })
        .eq("id", p.id);
    } else {
      await sb
        .from("prospect_nudges")
        .update({ last_nudge_error: result.error || "send failed" })
        .eq("id", p.id);

      if (newRetryCount >= 2) {
        await sb
          .from("prospect_nudges")
          .update({ status: "dead_undeliverable" })
          .eq("id", p.id);
        markedDead++;
        await sendSMS(
          ADMIN_PHONE,
          TWILIO_PHONE_NUMBER,
          `⚠️ Prospect ${p.phone} undeliverable after 2 retries. Marked dead.`,
          "dwa_admin_reply",
          false,
          { bypassQuietHours: true }
        );
      }
    }
  }

  return new Response(
    JSON.stringify({ retried, skipped_dedup: skippedDedup, skipped_claim: skippedClaim, marked_dead: markedDead, scanned: candidates.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
  return new Response(
    JSON.stringify({ retried, skipped_dedup: skippedDedup, skipped_lock: skippedLock, marked_dead: markedDead, scanned: candidates.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
