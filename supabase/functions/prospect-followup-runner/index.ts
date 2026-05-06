// prospect-followup-runner — Cron every 30 min.
//
// Finds prospect_nudges rows where:
//   - scheduled_follow_up_at <= now()
//   - follow_up_sent_at IS NULL
//   - clicked_at IS NULL  (skip anyone who already re-engaged)
//   - status NOT IN ('dead','dead_undeliverable','converted','opted_out')
//
// For each due row: sends a fresh tracked nudge SMS (different copy from the
// initial one so it doesn't look like a duplicate), marks follow_up_sent_at,
// and writes follow_up_status='sent' (or 'skipped_clicked' when applicable).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const FOLLOWUP_TEMPLATE = (trackedUrl: string, city: string | null, trade: string | null) => {
  const where = city ? ` in ${city}` : "";
  const what = trade ? ` ${trade} ` : " ";
  return `Quick follow-up — Matt with Detroit Web Agency. Wanted to make sure you saw this: exclusive${what}leads for contractors${where}, no contracts. ${trackedUrl} — reply STOP to opt out.`;
};

serve(async (_req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing creds" }), { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const nowIso = new Date().toISOString();

  const { data: due, error } = await sb
    .from("prospect_nudges")
    .select("id, phone, city, trade, link_token, clicked_at, status")
    .lte("scheduled_follow_up_at", nowIso)
    .is("follow_up_sent_at", null)
    .not("status", "in", "(dead,dead_undeliverable,converted,opted_out)")
    .limit(50);

  if (error) {
    console.error("[prospect-followup-runner] query error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped_clicked: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let skippedClicked = 0;
  let failed = 0;

  for (const p of due) {
    // Optimistic claim — only one cron run wins this row.
    const { data: claimed, error: claimErr } = await sb
      .from("prospect_nudges")
      .update({ follow_up_sent_at: nowIso, follow_up_status: "claimed" })
      .eq("id", p.id)
      .is("follow_up_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) continue;

    // Skip if already clicked (re-engaged) — release claim with skipped_clicked
    if (p.clicked_at) {
      await sb
        .from("prospect_nudges")
        .update({ follow_up_status: "skipped_clicked" })
        .eq("id", p.id);
      skippedClicked++;
      continue;
    }

    const trackedUrl = `https://detroitwebagent.com/r/${p.link_token}`;
    const body = FOLLOWUP_TEMPLATE(trackedUrl, p.city, p.trade);
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
        .update({ follow_up_status: "sent", last_nudge_sid: result.sid, last_nudge_status: "queued" })
        .eq("id", p.id);
      sent++;
    } else if (result.skipped) {
      // Quiet hours / opt-out — release the claim so the next cron retries
      await sb
        .from("prospect_nudges")
        .update({ follow_up_sent_at: null, follow_up_status: "pending" })
        .eq("id", p.id);
    } else {
      await sb
        .from("prospect_nudges")
        .update({ follow_up_status: "failed", last_nudge_error: result.error || "send failed" })
        .eq("id", p.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped_clicked: skippedClicked, failed, scanned: due.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
