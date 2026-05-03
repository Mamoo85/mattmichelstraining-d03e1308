// Unified email suppression / dedup helper.
// Used by every cold-email sender (multi_service_drip, web_design_drip, contractor-prospector,
// techalert-outreach, prospect-local-businesses) to enforce:
//   1. Never email an address on the suppression list (manual, bounced, complaint, unsubscribed)
//   2. Never email the same address twice across ANY product (dedup against email_send_log)
//   3. Never email a hard-bounced address again
//
// Usage:
//   import { isEmailBlocked, filterSendable } from "../_shared/email-suppression.ts";
//   const blocked = await isEmailBlocked(sb, "foo@bar.com");
//   if (blocked) skip;

export async function isEmailBlocked(sb: any, email: string | null | undefined): Promise<boolean> {
  if (!email) return true;
  const e = String(email).trim().toLowerCase();
  if (!e || !e.includes("@")) return true;

  // Single RPC call covers suppression list + bounced/complained/dlq history
  const { data, error } = await sb.rpc("is_email_suppressed", { p_email: e });
  if (error) {
    console.error("[email-suppression] rpc error", error.message);
    // Fall back to direct dedup check against any prior send
    const { count } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .ilike("recipient_email", e)
      .in("status", ["sent", "bounced", "complained", "suppressed", "dlq"]);
    return (count ?? 0) > 0;
  }
  return data === true;
}

/**
 * Filter a list of candidate emails down to ones we are allowed to send to.
 * Returns the sendable subset and a count of removed-by-reason for telemetry.
 */
export async function filterSendable(
  sb: any,
  emails: string[],
): Promise<{ sendable: string[]; blocked: string[]; }> {
  const unique = Array.from(new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean)));
  if (unique.length === 0) return { sendable: [], blocked: [] };

  const sendable: string[] = [];
  const blocked: string[] = [];
  // Fetch suppression matches in one round-trip
  const { data: suppRows } = await sb
    .from("email_suppression_unified")
    .select("email")
    .in("email", unique);
  const suppSet = new Set((suppRows || []).map((r: any) => r.email));

  // Fetch any prior send records (dedup across all products)
  const { data: sentRows } = await sb
    .from("email_send_log")
    .select("recipient_email")
    .in("recipient_email", unique)
    .in("status", ["sent", "bounced", "complained", "suppressed", "dlq"]);
  const sentSet = new Set((sentRows || []).map((r: any) => String(r.recipient_email).toLowerCase()));

  for (const e of unique) {
    if (suppSet.has(e) || sentSet.has(e)) blocked.push(e);
    else sendable.push(e);
  }
  return { sendable, blocked };
}
