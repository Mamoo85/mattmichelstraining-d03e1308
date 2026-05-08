// Shared email sanity filter — rejects scraped-directory garbage,
// URL-encoded characters, role inboxes (optional), and non-apex domains.
// Used by every outbound function (techalert-outreach, teaser-blast, etc.)
// to protect Resend deliverability and sending domain reputation.

export const DIRECTORY_DOMAINS = new Set([
  "localedge.com","yellowpages.com","yelp.com","manta.com","superpages.com",
  "merchantcircle.com","bbb.org","mapquest.com","foursquare.com","houzz.com",
  "thomasnet.com","angi.com","homeadvisor.com","thumbtack.com","porch.com",
  "nextdoor.com","zoominfo.com","dnb.com","corporationwiki.com","opengovus.com",
  "sam.gov","yellowbook.com","cylex.us.com","brownbook.net","tupalo.co",
  "ezlocal.com","cybo.com","tradeford.com","exportersindia.com","example.com",
  "gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com",
  "indeed.com","linkedin.com","facebook.com","instagram.com",
]);

export interface EmailSanityResult {
  ok: boolean;
  reason?:
    | "empty"
    | "bad_format"
    | "url_encoded_garbage"
    | "too_long"
    | "directory_domain"
    | "bad_domain_chars"
    | "non_apex_subdomain";
}

export function checkEmailSanity(raw: string | null | undefined): EmailSanityResult {
  const e = (raw || "").toLowerCase().trim();
  if (!e) return { ok: false, reason: "empty" };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return { ok: false, reason: "bad_format" };
  if (/[%<>"'\\]/.test(e)) return { ok: false, reason: "url_encoded_garbage" };
  if (e.length > 80) return { ok: false, reason: "too_long" };
  const domain = e.split("@")[1];
  if (DIRECTORY_DOMAINS.has(domain)) return { ok: false, reason: "directory_domain" };
  if (/[^a-z0-9.\-]/.test(domain)) return { ok: false, reason: "bad_domain_chars" };
  const parts = domain.split(".");
  // Allow co.uk-style 2-part TLDs (3 segments) by checking last segment is short.
  if (parts.length === 2) return { ok: true };
  if (parts.length === 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length <= 3) {
    return { ok: true };
  }
  return { ok: false, reason: "non_apex_subdomain" };
}

export function emailLooksValid(raw: string | null | undefined): boolean {
  return checkEmailSanity(raw).ok;
}
