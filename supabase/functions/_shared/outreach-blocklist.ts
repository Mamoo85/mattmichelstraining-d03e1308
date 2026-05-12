// Shared outreach blocklist helper
// Used by every cold-outreach engine to enforce:
//   1. Paying clients are NEVER cold-pitched
//   2. 90-day grace period between any two contacts to the same business/phone/email/domain
//
// Usage:
//   import { isBlocked, recordOutreach } from "../_shared/outreach-blocklist.ts";
//   const block = await isBlocked(supabase, { phone, email, business_name });
//   if (block.blocked) { skip; continue; }
//   await sendPitch(...);
//   await recordOutreach(supabase, { phone, email, business_name, agent: "tom-autonomous" });

export interface BlocklistIdentifiers {
  phone?: string | null;
  email?: string | null;
  business_name?: string | null;
  domain?: string | null;
}

export interface BlockedResult {
  blocked: boolean;
  reason?: string;
  blocked_until?: string | null;
  matched_on?: string;
}

function extractDomain(input?: string | null): string | null {
  if (!input) return null;
  let d = input.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, "");
  if (d.includes("@")) d = d.split("@")[1] ?? d;
  d = d.split("/")[0] ?? d;
  d = d.replace(/^www\./, "");
  return d || null;
}

function normPhone(p?: string | null): string | null {
  if (!p) return null;
  const cleaned = p.replace(/[^\d+]/g, "");
  return cleaned || null;
}

function normEmail(e?: string | null): string | null {
  if (!e) return null;
  const cleaned = e.trim().toLowerCase();
  return cleaned || null;
}

function normBiz(b?: string | null): string | null {
  if (!b) return null;
  const cleaned = b.trim().toLowerCase();
  return cleaned || null;
}

/**
 * Check if any of the supplied identifiers is currently blocked.
 * Returns blocked=true if a row exists with blocked_until IS NULL (forever)
 * OR blocked_until > now() (still in cooldown).
 */
export async function isBlocked(
  supabase: any,
  ids: BlocklistIdentifiers,
): Promise<BlockedResult> {
  const phone = normPhone(ids.phone);
  const email = normEmail(ids.email);
  const business = normBiz(ids.business_name);
  const domain = ids.domain ? normBiz(ids.domain) : extractDomain(email);

  if (!phone && !email && !business && !domain) {
    return { blocked: false };
  }

  // PostgREST .or() uses commas as separators; values with commas/parens must be quoted.
  // Wrap every value in double quotes to be safe.
  const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
  const orConditions: string[] = [];
  if (phone) orConditions.push(`phone.eq.${q(phone)}`);
  if (email) orConditions.push(`email.eq.${q(email)}`);
  if (domain) orConditions.push(`domain.eq.${q(domain)}`);
  if (business) orConditions.push(`business_name.eq.${q(business)}`);

  const { data, error } = await supabase
    .from("outreach_blocklist")
    .select("reason, blocked_until, phone, email, domain, business_name")
    .or(orConditions.join(","))
    .limit(50);

  if (error) {
    console.error("[blocklist] query error:", error.message);
    return { blocked: false }; // fail-open to not break outreach on DB hiccup
  }

  const now = Date.now();
  for (const row of data ?? []) {
    const stillBlocked = row.blocked_until === null || new Date(row.blocked_until).getTime() > now;
    if (!stillBlocked) continue;
    let matched = "unknown";
    if (phone && row.phone === phone) matched = "phone";
    else if (email && row.email === email) matched = "email";
    else if (domain && row.domain === domain) matched = "domain";
    else if (business && row.business_name === business) matched = "business_name";
    return {
      blocked: true,
      reason: row.reason,
      blocked_until: row.blocked_until,
      matched_on: matched,
    };
  }
  return { blocked: false };
}

/**
 * Record that we just sent cold outreach to this prospect.
 * Writes a 90-day cooldown row. Paying clients already have NULL (forever) rows
 * via DB triggers — those take precedence.
 */
/**
 * Cross-product 7-day deduplication check.
 * Returns true if this domain was contacted (via any product) within the last 7 days.
 * Used by trade-radar-outreach and other outreach functions before sending.
 */
export async function isRecentlyContacted(
  supabase: any,
  domain: string,
): Promise<boolean> {
  if (!domain) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await supabase
      .from("global_outreach_log")
      .select("id")
      .eq("domain", domain.toLowerCase())
      .gte("contacted_at", sevenDaysAgo)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false; // fail open — never block outreach due to a lookup error
  }
}

/**
 * Record that we just sent cold outreach to this prospect.
 * Writes a 90-day cooldown row. Paying clients already have NULL (forever) rows
 * via DB triggers — those take precedence.
 */
export async function recordOutreach(
  supabase: any,
  ids: BlocklistIdentifiers & { agent: string },
): Promise<void> {
  const phone = normPhone(ids.phone);
  const email = normEmail(ids.email);
  const business = normBiz(ids.business_name);
  const domain = ids.domain ? normBiz(ids.domain) : extractDomain(email);

  if (!phone && !email && !business && !domain) return;

  const blockedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await supabase.from("outreach_blocklist").insert({
      business_name: business,
      phone,
      email,
      domain,
      reason: "recent_outreach",
      source_agent: ids.agent,
      blocked_until: blockedUntil,
    });
  } catch (e) {
    console.error("[blocklist] recordOutreach error:", (e as Error).message);
  }
}
