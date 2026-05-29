// Shared throttle/dedup gate for notifyMatt() and other admin alerts.
//
// Behavior:
// - First hit on a key in a window → allowed (returns true).
// - Subsequent hits within the window → suppressed (returns false), counter increments.
// - When the window elapses, the next hit is allowed and includes a "(N suppressed
//   in last X min)" suffix you can append to the subject for visibility.
//
// Backed by public.alert_throttle (service role). Failures are non-fatal —
// if the DB call fails we fall back to "allow" so we never silence a real alert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export interface ThrottleDecision {
  allowed: boolean;
  suppressedSinceLastSend: number;
  windowMinutes: number;
}

/**
 * Check whether an alert with the given key should be sent.
 * @param key       Stable identifier for the alert family (e.g. "stripe_webhook_signature_error").
 * @param windowMin Minutes between allowed sends for this key. Default 30.
 */
export async function shouldSendAlert(
  key: string,
  windowMin = 30,
): Promise<ThrottleDecision> {
  // Fail open: if we can't reach the DB, allow the alert through.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { allowed: true, suppressedSinceLastSend: 0, windowMinutes: windowMin };
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowMin * 60_000);

    const { data: existing } = await sb
      .from("alert_throttle")
      .select("alert_key, last_sent_at, suppressed_count")
      .eq("alert_key", key)
      .maybeSingle();

    // First time we've ever seen this key → record and allow.
    if (!existing) {
      await sb.from("alert_throttle").insert({
        alert_key: key,
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        last_sent_at: now.toISOString(),
        hit_count: 1,
        suppressed_count: 0,
        window_minutes: windowMin,
      });
      return { allowed: true, suppressedSinceLastSend: 0, windowMinutes: windowMin };
    }

    const lastSent = existing.last_sent_at ? new Date(existing.last_sent_at) : null;
    const withinWindow = lastSent !== null && lastSent > cutoff;

    if (withinWindow) {
      // Suppress: bump counters, do not send.
      await sb
        .from("alert_throttle")
        .update({
          last_seen_at: now.toISOString(),
          hit_count: ((existing as any).hit_count ?? 0) + 1,
          suppressed_count: ((existing as any).suppressed_count ?? 0) + 1,
        })
        .eq("alert_key", key);
      return { allowed: false, suppressedSinceLastSend: 0, windowMinutes: windowMin };
    }

    // Window elapsed: capture how many we suppressed, reset, and allow.
    const suppressed = (existing as any).suppressed_count ?? 0;
    await sb
      .from("alert_throttle")
      .update({
        last_seen_at: now.toISOString(),
        last_sent_at: now.toISOString(),
        hit_count: ((existing as any).hit_count ?? 0) + 1,
        suppressed_count: 0,
        window_minutes: windowMin,
      })
      .eq("alert_key", key);
    return { allowed: true, suppressedSinceLastSend: suppressed, windowMinutes: windowMin };
  } catch (e) {
    console.error("[alert-throttle] DB error — failing open:", e);
    return { allowed: true, suppressedSinceLastSend: 0, windowMinutes: windowMin };
  }
}

/**
 * Hash an arbitrary string into a short stable suffix, useful for keying alerts
 * by message content when no natural key exists.
 */
export function alertHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return (h >>> 0).toString(36);
}
