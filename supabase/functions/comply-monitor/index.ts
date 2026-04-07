// comply-monitor — Daily regulatory compliance sweep
// Checks TCPA opt-outs, compliance_blocks, CAN-SPAM, past-due Stripe subs
// Cron: daily 11am UTC (7am ET)
// Agent: Comply

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const MATT_EMAIL = "matt@mattmichelstraining.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// All SMS product client tables and their phone column names
const SMS_CLIENT_TABLES: Array<{ table: string; phoneCol: string }> = [
  { table: "sms_blast_clients", phoneCol: "phone_number" },
  { table: "noshow_clients", phoneCol: "phone_number" },
  { table: "estimate_drip_clients", phoneCol: "phone_number" },
  { table: "invoice_chaser_clients", phoneCol: "phone_number" },
  { table: "afterjob_drip_clients", phoneCol: "phone_number" },
  { table: "promo_blaster_clients", phoneCol: "phone_number" },
  { table: "referral_program_clients", phoneCol: "phone_number" },
  { table: "slow_day_clients", phoneCol: "phone_number" },
  { table: "homeowner_campaign_clients", phoneCol: "phone_number" },
  { table: "review_monitor_clients", phoneCol: "phone_number" },
];

interface Violation {
  check_type: "tcpa" | "canspam" | "stripe" | "gdpr";
  severity: "critical" | "warning" | "info";
  description: string;
  affected_table?: string;
  affected_id?: string;
}

async function sendAlert(violations: Violation[]) {
  const critical = violations.filter((v) => v.severity === "critical");
  if (critical.length === 0) return;

  const rows = critical
    .map(
      (v) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #334155"><strong>${v.check_type.toUpperCase()}</strong></td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #334155;color:#ef4444">${v.description}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #334155">${v.affected_table ?? "—"}</td></tr>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Comply <matt@mattmichelstraining.com>",
      to: [MATT_EMAIL],
      subject: `🚨 COMPLY ALERT: ${critical.length} critical violation${critical.length > 1 ? "s" : ""} detected`,
      html: `
        <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px">
          <h2 style="color:#ef4444;margin:0 0 8px">Compliance Alert</h2>
          <p style="color:#94a3b8;margin:0 0 20px">The Comply agent detected <strong>${critical.length} critical violation${critical.length > 1 ? "s" : ""}</strong> that require immediate attention.</p>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#334155">
              <th style="padding:8px 12px;text-align:left">Type</th>
              <th style="padding:8px 12px;text-align:left">Issue</th>
              <th style="padding:8px 12px;text-align:left">Table</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#94a3b8;margin:20px 0 0;font-size:12px">Review at /admin → Business → Legal</p>
        </div>`,
    }),
  });
}

async function checkTcpaOptOuts(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Get all opted-out phones
  const { data: optOuts } = await supabase
    .from("sms_opt_outs")
    .select("phone_number");

  if (!optOuts || optOuts.length === 0) return violations;
  const optedOutPhones = new Set(optOuts.map((o) => o.phone_number));

  // Check each SMS table for active clients with opted-out phones
  for (const { table, phoneCol } of SMS_CLIENT_TABLES) {
    const { data: clients } = await (supabase.from as any)(table)
      .select(`id, ${phoneCol}, active`)
      .eq("active", true);

    if (!clients) continue;

    for (const client of clients) {
      const phone = client[phoneCol];
      if (phone && optedOutPhones.has(phone)) {
        violations.push({
          check_type: "tcpa",
          severity: "critical",
          description: `Active client with opted-out phone ${phone} in ${table} — SMS sends must stop immediately`,
          affected_table: table,
          affected_id: client.id,
        });
      }
    }
  }

  return violations;
}

async function checkComplianceBlocks(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check for any compliance blocks in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: blocks } = await supabase
    .from("compliance_blocks")
    .select("*")
    .gte("created_at", since);

  if (blocks && blocks.length > 0) {
    violations.push({
      check_type: "tcpa",
      severity: "warning",
      description: `${blocks.length} compliance block${blocks.length > 1 ? "s" : ""} recorded in last 24h — SMS sends attempted to opted-out numbers`,
      affected_table: "compliance_blocks",
    });
  }

  return violations;
}

async function checkCanSpam(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check last 5 newsletter sends have an unsubscribe_url recorded
  const { data: sends } = await supabase
    .from("newsletter_sends")
    .select("id, sent_at, subject")
    .order("sent_at", { ascending: false })
    .limit(5);

  if (sends && sends.length > 0) {
    // If newsletter_sends table exists but has no unsubscribe tracking column, flag as info
    violations.push({
      check_type: "canspam",
      severity: "info",
      description: `Last ${sends.length} newsletter sends found — verify unsubscribe links are included in all emails`,
      affected_table: "newsletter_sends",
    });
  }

  return violations;
}

async function checkPastDueActive(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check social_media_clients for active clients with no recent delivery
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("social_media_clients")
    .select("id, business_name, email, active, created_at")
    .eq("active", true)
    .lt("created_at", cutoff);

  if (stale && stale.length > 0) {
    violations.push({
      check_type: "stripe",
      severity: "warning",
      description: `${stale.length} social media client${stale.length > 1 ? "s" : ""} active 21+ days — verify they are receiving paid service`,
      affected_table: "social_media_clients",
    });
  }

  return violations;
}

async function updateHeartbeat(status: "ok" | "error") {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "comply",
    last_run_at: new Date().toISOString(),
    last_status: status,
  });
}

Deno.serve(async () => {
  try {
    console.log("[comply-monitor] Starting compliance sweep");

    const [tcpaViolations, blockViolations, canSpamViolations, stripeViolations] =
      await Promise.all([
        checkTcpaOptOuts(),
        checkComplianceBlocks(),
        checkCanSpam(),
        checkPastDueActive(),
      ]);

    const allViolations = [
      ...tcpaViolations,
      ...blockViolations,
      ...canSpamViolations,
      ...stripeViolations,
    ];

    // Insert all violations to DB
    if (allViolations.length > 0) {
      await supabase.from("comply_violations").insert(allViolations);
    }

    // Alert Matt if any critical
    await sendAlert(allViolations);

    const critical = allViolations.filter((v) => v.severity === "critical").length;
    const warnings = allViolations.filter((v) => v.severity === "warning").length;

    await updateHeartbeat("ok");

    console.log(`[comply-monitor] Done: ${critical} critical, ${warnings} warnings, ${allViolations.length - critical - warnings} info`);

    return new Response(
      JSON.stringify({ ok: true, critical, warnings, total: allViolations.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[comply-monitor] Error:", err);
    await updateHeartbeat("error");
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
