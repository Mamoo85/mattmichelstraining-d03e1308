// Tiny tracker for trial-funnel landing pages. Fire-and-forget; never throws.
// Writes to public.trial_funnel_events (anon insert allowed via RLS).
import { supabase } from "@/integrations/supabase/client";

export type TrialFunnelEvent =
  | "view"
  | "picker_view"
  | "picker_select"
  | "form_focus"
  | "form_submit"
  | "form_submit_failure"
  | "checkout_redirect"
  | "trial_success"
  | "trial_error"
  | "escape_hatch_click"
  | "sticky_cta_click";

const SESSION_KEY = "trial_funnel_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto as any)?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

function getUtm(): Record<string, string> {
  try {
    const sp = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "rcpt"].forEach((k) => {
      const v = sp.get(k);
      if (v) out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

export function trackTrialEvent(
  eventType: TrialFunnelEvent,
  product: string | null,
  extra?: { email?: string; metadata?: Record<string, unknown> },
): void {
  try {
    const args = {
      p_event_type: eventType,
      p_product: product ?? null,
      p_email: extra?.email?.trim().toLowerCase() || null,
      p_session_id: getSessionId(),
      p_metadata: extra?.metadata ?? {},
      p_utm: getUtm(),
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      p_referrer: typeof document !== "undefined" ? (document.referrer || "").slice(0, 500) : null,
    };
    // Fire-and-forget. Goes through SECURITY DEFINER RPC so anon INSERT stays revoked at the table level.
    void (supabase as any).rpc("log_trial_funnel_event", args).then(() => {}, () => {});
  } catch {
    /* swallow */
  }
}
