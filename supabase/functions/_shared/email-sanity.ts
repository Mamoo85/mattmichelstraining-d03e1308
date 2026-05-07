// Pre-send email sanity checks: DNS MX lookup + disposable/role address rejection.
// Call from dwaColdEmail() before any outreach send. Fail-open on DNS errors
// to avoid blocking legitimate sends during transient network issues.

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "10minutemail.com", "yopmail.com", "trashmail.com", "fakeinbox.com",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
  "spam4.me", "trashmail.at", "trashmail.io", "trashmail.me", "dispostable.com",
  "mailnull.com", "spamgourmet.com", "maildrop.cc", "getairmail.com",
]);

const ROLE_PREFIXES = [
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "postmaster", "mailer-daemon", "abuse", "hostmaster",
  "webmaster", "bounces", "bounce",
];

export async function checkEmailSanity(email: string): Promise<{ ok: boolean; reason?: string }> {
  if (!email || !email.includes("@")) return { ok: false, reason: "invalid_format" };

  const parts = email.split("@");
  if (parts.length !== 2) return { ok: false, reason: "invalid_format" };

  const local = parts[0].toLowerCase();
  const domain = parts[1].toLowerCase();

  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: "disposable" };

  if (ROLE_PREFIXES.some((p) => local === p || local.startsWith(p + "."))) {
    return { ok: false, reason: "role_address" };
  }

  try {
    const mx = await Deno.resolveDns(domain, "MX");
    if (!mx || mx.length === 0) return { ok: false, reason: "no_mx" };
  } catch {
    // DNS lookup failed (network error, NXDOMAIN) — fail open so transient
    // DNS issues don't silence legitimate sends.
    return { ok: true };
  }

  return { ok: true };
}
