// Shared helper: check the marketing kill switch before any blast/pitch send.
// When ON, blocks marketing email blasts + outreach campaigns.
// Does NOT affect: auth emails, transactional receipts, customer-facing SMS.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function isMarketingBlocked(sb?: SupabaseClient): Promise<{ blocked: boolean; reason?: string }> {
  const client = sb ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const { data, error } = await client
      .from("marketing_kill_switch")
      .select("enabled, reason")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.warn("[kill-switch] read failed, failing open:", error.message);
      return { blocked: false };
    }
    return { blocked: !!data?.enabled, reason: data?.reason ?? undefined };
  } catch (e) {
    console.warn("[kill-switch] exception, failing open:", e);
    return { blocked: false };
  }
}

export async function logPitchAudit(
  sb: SupabaseClient,
  row: {
    template_name: string;
    recipient_email: string;
    status: "sent" | "blocked" | "failed";
    error_message?: string;
    triggered_by?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await sb.from("pitch_send_audit").insert(row);
  } catch (e) {
    console.warn("[pitch-audit] log failed:", e);
  }
}
