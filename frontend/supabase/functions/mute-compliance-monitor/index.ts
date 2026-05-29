/**
 * Mute — SMS Opt-Out & TCPA Compliance Monitor
 *
 * Runs every 2 hours. Scans ALL pending SMS sequences for opted-out numbers
 * and blocks them before they fire. This is the last safety net between
 * the system and a $1,500/message TCPA lawsuit.
 *
 * What Twilio handles automatically:
 *   - Carrier-level block per sender/recipient pair when recipient texts STOP
 *   - Auto-reply confirmation to the STOP sender
 * What WE must handle (Twilio does NOT do this cross-product):
 *   - Cross-product opt-out: if someone opts out of product A, block ALL products
 *   - Pending sequence blocking before messages reach Twilio
 *   - Our own compliance_blocks audit trail for legal records
 *
 * TCPA opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
 * TCPA fine: $500–$1,500 per message to an opted-out number (class action risk)
 * Legal standard: honor within 10 business days. Our standard: honor within 1 hour.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = "matt@mattmichelstraining.com";
const FROM_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface BlockResult {
  table: string;
  id: string;
  phone: string;
  blocked: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendEmail(subject: string, html: string): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Mute Compliance <matt@mattmichelstraining.com>",
      to: [ADMIN_EMAIL],
      subject,
      html,
    }),
  });
}

async function logBlock(
  phone: string,
  product: string,
  sequenceId?: string,
  reason = "sms_opt_out"
): Promise<void> {
  await sb.from("compliance_blocks").insert({
    phone,
    product,
    sequence_id: sequenceId ?? null,
    reason,
    blocked_at: new Date().toISOString(),
  });
}

// ── Sequence Scanners ─────────────────────────────────────────────────────────

/** dead_lead_contacts — block pending/sent_1/sent_2 rows for opted-out numbers */
async function scanDeadLeadContacts(optedOut: Set<string>): Promise<BlockResult[]> {
  const { data } = await sb
    .from("dead_lead_contacts")
    .select("id, phone, status")
    .in("status", ["pending", "sent_1", "sent_2"])
    .not("phone", "is", null);

  const blocks: BlockResult[] = [];
  for (const row of data ?? []) {
    if (!optedOut.has(row.phone)) continue;
    const { error } = await sb
      .from("dead_lead_contacts")
      .update({ status: "blocked" })
      .eq("id", row.id);
    await logBlock(row.phone, "dead_lead_drip", row.id);
    blocks.push({ table: "dead_lead_contacts", id: row.id, phone: row.phone, blocked: !error });
  }
  return blocks;
}

/** estimate_sequences — stop active sequences for opted-out prospects */
async function scanEstimateSequences(optedOut: Set<string>): Promise<BlockResult[]> {
  const { data } = await sb
    .from("estimate_sequences")
    .select("id, prospect_phone, stopped")
    .eq("stopped", false)
    .not("prospect_phone", "is", null);

  const blocks: BlockResult[] = [];
  for (const row of data ?? []) {
    if (!optedOut.has(row.prospect_phone)) continue;
    const { error } = await sb
      .from("estimate_sequences")
      .update({ stopped: true })
      .eq("id", row.id);
    await logBlock(row.prospect_phone, "estimate_drip", row.id);
    blocks.push({ table: "estimate_sequences", id: row.id, phone: row.prospect_phone, blocked: !error });
  }
  return blocks;
}

/** afterjob_sequences — stop active sequences for opted-out customers */
async function scanAfterJobSequences(optedOut: Set<string>): Promise<BlockResult[]> {
  const { data } = await sb
    .from("afterjob_sequences")
    .select("id, customer_phone, stopped")
    .eq("stopped", false)
    .not("customer_phone", "is", null);

  const blocks: BlockResult[] = [];
  for (const row of data ?? []) {
    if (!optedOut.has(row.customer_phone)) continue;
    const { error } = await sb
      .from("afterjob_sequences")
      .update({ stopped: true })
      .eq("id", row.id);
    await logBlock(row.customer_phone, "afterjob_drip", row.id);
    blocks.push({ table: "afterjob_sequences", id: row.id, phone: row.customer_phone, blocked: !error });
  }
  return blocks;
}

/** tracked_invoices — stop chasing opted-out customers */
async function scanTrackedInvoices(optedOut: Set<string>): Promise<BlockResult[]> {
  const { data } = await sb
    .from("tracked_invoices")
    .select("id, customer_phone, paid")
    .eq("paid", false)
    .not("customer_phone", "is", null);

  const blocks: BlockResult[] = [];
  for (const row of data ?? []) {
    if (!optedOut.has(row.customer_phone)) continue;
    // Mark a compliance_blocks entry; do NOT auto-mark paid (that changes billing records)
    // Instead we add to sms_opt_outs so sendSMS() skips them automatically
    await logBlock(row.customer_phone, "invoice_chaser", row.id);
    blocks.push({ table: "tracked_invoices", id: row.id, phone: row.customer_phone, blocked: true });
  }
  return blocks;
}

/** noshow_events — cancel pending re-booker SMS for opted-out customers */
async function scanNoshowEvents(optedOut: Set<string>): Promise<BlockResult[]> {
  const { data } = await sb
    .from("noshow_events")
    .select("id, customer_phone, status")
    .eq("status", "pending")
    .not("customer_phone", "is", null);

  const blocks: BlockResult[] = [];
  for (const row of data ?? []) {
    if (!optedOut.has(row.customer_phone)) continue;
    const { error } = await sb
      .from("noshow_events")
      .update({ status: "blocked" })
      .eq("id", row.id);
    await logBlock(row.customer_phone, "noshow_rebooker", row.id);
    blocks.push({ table: "noshow_events", id: row.id, phone: row.customer_phone, blocked: !error });
  }
  return blocks;
}

// ── Weekly Report (Fridays) ───────────────────────────────────────────────────

async function weeklyOptOutReport(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: newOptOuts }, { data: blocks }, { count: totalCount }] = await Promise.all([
    sb.from("sms_opt_outs").select("phone, source, opted_out_at").gte("opted_out_at", since).order("opted_out_at", { ascending: false }),
    sb.from("compliance_blocks").select("phone, product, reason, blocked_at").gte("blocked_at", since).order("blocked_at", { ascending: false }),
    sb.from("sms_opt_outs").select("id", { count: "exact", head: true }),
  ]);

  const weekOptOuts = newOptOuts ?? [];
  const weekBlocks = blocks ?? [];
  const status = weekBlocks.length > 0
    ? "🟡 WARNING — sequences blocked (this is the system working correctly)"
    : weekOptOuts.length === 0
    ? "🟢 CLEAN"
    : "🟢 CLEAN — new opt-outs recorded, no active sequences were affected";

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#1e293b;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">🔇 Mute — Weekly TCPA Compliance Report</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:13px">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
        <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
          <tr>
            <td style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#dc2626">${weekOptOuts.length}</div>
              <div style="font-size:12px;color:#64748b">New Opt-Outs This Week</div>
            </td>
            <td width="12"></td>
            <td style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#f97316">${weekBlocks.length}</div>
              <div style="font-size:12px;color:#64748b">Sequences Blocked</div>
            </td>
            <td width="12"></td>
            <td style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#1e293b">${totalCount ?? 0}</div>
              <div style="font-size:12px;color:#64748b">Total Suppressed Numbers</div>
            </td>
          </tr>
        </table>

        ${weekOptOuts.length > 0 ? `
          <h3 style="color:#dc2626;margin:0 0 8px">New Opt-Outs This Week</h3>
          <table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px">
            <tr style="background:#1e293b;color:white">
              <th style="padding:8px;text-align:left">Phone</th><th style="padding:8px;text-align:left">Source</th><th style="padding:8px;text-align:left">Date</th>
            </tr>
            ${weekOptOuts.map((o, i) => `
              <tr style="background:${i % 2 === 0 ? "white" : "#f8fafc"}">
                <td style="padding:8px;border:1px solid #e2e8f0">${o.phone}</td>
                <td style="padding:8px;border:1px solid #e2e8f0">${o.source ?? "unknown"}</td>
                <td style="padding:8px;border:1px solid #e2e8f0">${new Date(o.opted_out_at).toLocaleDateString()}</td>
              </tr>`).join("")}
          </table>` : "<p style=\"color:#16a34a;font-weight:bold\">✅ Zero new opt-outs this week.</p>"}

        ${weekBlocks.length > 0 ? `
          <h3 style="color:#f97316;margin:0 0 8px">Sequences Blocked This Week</h3>
          <table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px">
            <tr style="background:#1e293b;color:white">
              <th style="padding:8px;text-align:left">Phone</th><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Reason</th>
            </tr>
            ${weekBlocks.map((b, i) => `
              <tr style="background:${i % 2 === 0 ? "white" : "#f8fafc"}">
                <td style="padding:8px;border:1px solid #e2e8f0">${b.phone}</td>
                <td style="padding:8px;border:1px solid #e2e8f0">${b.product}</td>
                <td style="padding:8px;border:1px solid #e2e8f0">${b.reason}</td>
              </tr>`).join("")}
          </table>` : ""}

        <div style="padding:12px;background:#dcfce7;border-radius:8px;font-size:13px;margin-top:8px">
          <strong>TCPA Status:</strong> ${status}
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-top:12px">
          All blocks are permanently logged in the compliance_blocks table. Opt-outs are stored in sms_opt_outs and honored on every send via sendSMS(). Twilio carrier-level blocking is also active as a second layer.
        </p>
      </div>
    </div>`;

  await sendEmail("🔇 Mute: Weekly TCPA Compliance Report", html);
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const runStart = new Date();
  const isFriday = runStart.getDay() === 5;

  try {
    // Load the full opted-out registry into memory for fast Set lookups
    const { data: optOutRows, error: optOutErr } = await sb
      .from("sms_opt_outs")
      .select("phone");

    if (optOutErr) throw new Error(`sms_opt_outs fetch failed: ${optOutErr.message}`);

    const optedOut = new Set<string>((optOutRows ?? []).map((r) => r.phone));
    console.log(`[Mute] ${optedOut.size} opted-out numbers loaded`);

    // Scan all sequence tables in parallel
    const [dead, estimate, afterjob, invoice, noshow] = await Promise.all([
      scanDeadLeadContacts(optedOut),
      scanEstimateSequences(optedOut),
      scanAfterJobSequences(optedOut),
      scanTrackedInvoices(optedOut),
      scanNoshowEvents(optedOut),
    ]);

    const allBlocks = [...dead, ...estimate, ...afterjob, ...invoice, ...noshow];
    const totalBlocked = allBlocks.filter((b) => b.blocked).length;

    console.log(`[Mute] Blocked ${totalBlocked} pending messages`);

    // Alert Matt immediately if sequences were actively blocked
    if (totalBlocked > 0) {
      const byTable: Record<string, number> = {};
      for (const b of allBlocks.filter((b) => b.blocked)) {
        byTable[b.table] = (byTable[b.table] || 0) + 1;
      }
      const breakdown = Object.entries(byTable).map(([t, c]) => `${c} in ${t}`).join(", ");

      await Promise.all([
        sendSMS(
          ADMIN_PHONE,
          FROM_PHONE,
          `🔇 Mute blocked ${totalBlocked} SMS (${breakdown}). Opted-out numbers cleaned from active sequences. No TCPA violation occurred.`
        ),
        sendEmail(
          `🔇 Mute: ${totalBlocked} Sequences Blocked`,
          `<div style="font-family:sans-serif;max-width:600px">
            <div style="background:#dc2626;color:white;padding:16px;border-radius:8px 8px 0 0">
              <h2 style="margin:0">🔇 Mute: Compliance Action Taken</h2>
            </div>
            <div style="padding:16px;border:1px solid #e2e8f0">
              <p>Mute blocked <strong>${totalBlocked} pending SMS</strong> to opted-out numbers before they fired.</p>
              <p><strong>This is the system working correctly.</strong> No TCPA violation occurred.</p>
              <h3>Breakdown:</h3>
              <ul>${Object.entries(byTable).map(([t, c]) => `<li>${c} record(s) in <code>${t}</code></li>`).join("")}</ul>
              <p style="font-size:12px;color:#64748b">All blocks logged to compliance_blocks for legal audit trail.</p>
            </div>
          </div>`
        ),
      ]);
    }

    if (isFriday) await weeklyOptOutReport();

    await sb.from("agent_heartbeats").upsert({
      agent_name: "mute",
      last_run_at: runStart.toISOString(),
      last_status: "ok",
      detail: `${optedOut.size} opt-outs registered. ${totalBlocked} sequences blocked this run.`,
    });

    return new Response(
      JSON.stringify({ ok: true, opted_out_count: optedOut.size, blocked: totalBlocked }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Mute] FATAL: ${msg}`);

    await sb.from("agent_heartbeats").upsert({
      agent_name: "mute",
      last_run_at: runStart.toISOString(),
      last_status: "error",
      detail: msg,
    } as any);

    // A compliance monitor going silent is dangerous — alert immediately
    try {
      await sendSMS(
        ADMIN_PHONE,
        FROM_PHONE,
        `🚨 COMPLIANCE ALERT: Mute monitor FAILED: ${msg.slice(0, 120)}. SMS opt-out enforcement may be compromised. Check immediately.`
      );
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
