// Founder & owner protected accounts.
// These emails must NEVER be:
//   - downgraded by stripe-reconciliation-sweep
//   - billed by any auto-charge / drip cron
//   - included in mass outreach campaigns (cold email, fax, postcard, SMS)
//   - subject to trial expiration in start-radar-trial / trial-lifecycle-orchestrator
//   - removed by churn / dormancy sweepers
//
// Confirmed in DB on 2026-05-02 — Mitchell Michels has is_founder=true on
// mortgage_radar_clients with no Stripe subscription.

export const FOUNDER_SEATS: ReadonlySet<string> = new Set([
  // Matt — owner / operator
  "matt@mattmichelstraining.com",
  "matt@detroitwebagent.com",
  "matthewmichels4@gmail.com",
  // Mitchell Michels — Mortgage Radar founder seat ($0/mo, lifetime)
  "mitch.michels@rate.com",
  "mitchellm77@gmail.com",
  // Pat Michels (DJ Conley) — Site Radar / DWA anchor client
  "pmichels@djconley.com",
]);

export function isFounder(email?: string | null): boolean {
  if (!email) return false;
  return FOUNDER_SEATS.has(email.trim().toLowerCase());
}

/**
 * Filters an array of recipient rows to remove any founder seats — use this
 * before EVERY mass outreach send (cold email, fax, postcard, SMS) and before
 * any automated downgrade / churn sweep.
 */
export function stripFounders<T extends { email?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !isFounder(r.email));
}
