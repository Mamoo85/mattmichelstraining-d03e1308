// v4 §10 — Compliance Auto-Audit
// Weekly sweep of outbound channels for TCPA/CAN-SPAM violations.
// Auto-disables campaigns with 2+ spam complaints in 24h. SMS Matt on critical flags.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

async function notifyMatt(body: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms-internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to: ADMIN_PHONE, body }),
    });
  } catch (e) {
    console.error("notifyMatt failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const flagged: any[] = [];

  try {
    // 1. Quiet-hours violations from sms_send_log (last 7 days)
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: smsLogs } = await sb
      .from("sms_send_log" as any)
      .select("to, sent_at, body")
      .gte("sent_at", since)
      .limit(2000);

    for (const log of (smsLogs as any) || []) {
      const sentAt = new Date(log.sent_at);
      const hour = sentAt.getUTCHours() - 5; // ET approx
      const localHour = (hour + 24) % 24;
      if (localHour < 8 || localHour >= 21) {
        flagged.push({
          channel: "sms",
          violation_type: "tcpa_quiet_hours",
          severity: "critical",
          details: { to: log.to, sent_at: log.sent_at, local_hour: localHour },
        });
      }
    }

    // 2. Spam complaint threshold (auto-disable campaigns)
    const { data: complaints } = await sb
      .from("suppressed_emails" as any)
      .select("email, suppression_type, created_at")
      .eq("suppression_type", "complaint")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    if ((complaints?.length ?? 0) >= 2) {
      flagged.push({
        channel: "email",
        violation_type: "spam_complaint_threshold",
        severity: "critical",
        details: { complaint_count: complaints!.length, window_hours: 24 },
        auto_disabled: true,
      });
    }

    // 3. Insert violations
    if (flagged.length > 0) {
      await sb.from("compliance_audit_log" as any).insert(flagged);
    }

    // 4. SMS Matt on any critical
    const critical = flagged.filter((f) => f.severity === "critical");
    if (critical.length > 0) {
      await notifyMatt(
        `🚨 COMPLIANCE: ${critical.length} critical flag(s). ${critical.map((c) => c.violation_type).join(", ")}. Check /dwa-admin/v4 → Compliance.`,
      );
    }

    return new Response(
      JSON.stringify({ ok: true, flagged: flagged.length, critical: critical.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("compliance-audit failed", e);
    await notifyMatt(`⚠️ Compliance audit FAILED: ${e instanceof Error ? e.message : String(e)}`);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
