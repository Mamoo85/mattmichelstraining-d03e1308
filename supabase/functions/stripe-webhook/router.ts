/**
 * Pure routing helper — maps metadata.type to the DB table that should be
 * provisioned. Extracted from index.ts so tests can verify routing decisions
 * without importing the Stripe SDK or Supabase client.
 *
 * Update this whenever a new product type is added to index.ts.
 */

export interface RouteDecision {
  /** Primary table to upsert/update on a successful checkout. */
  primaryTable: string;
  /** Human-readable product label for notifications. */
  productLabel: string;
  /** Whether this route is handled (false = falls to catch-all or unhandled). */
  handled: boolean;
}

const ROUTES: Record<string, RouteDecision> = {
  hire_alert_subscription:          { primaryTable: "hire_alert_clients",           productLabel: "TechAlert",              handled: true },
  techalert_pay_per_hire:           { primaryTable: "hire_alert_clients",           productLabel: "TechAlert PPH",          handled: true },
  agency_whitelabel_subscription:   { primaryTable: "agency_whitelabel_clients",    productLabel: "Agency Whitelabel",      handled: true },
  high_volume_buyer_subscription:   { primaryTable: "marketplace_prospects",        productLabel: "High Volume Buyer",      handled: true },
  industry_pulse_subscription:      { primaryTable: "industry_pulse_clients",       productLabel: "Industry Pulse",         handled: true },
  mortgage_radar_subscription:      { primaryTable: "mortgage_radar_clients",       productLabel: "Mortgage Radar",         handled: true },
  mortgage_radar_trial:             { primaryTable: "mortgage_radar_clients",       productLabel: "Mortgage Radar Trial",   handled: true },
  buyer_radar_subscription:         { primaryTable: "buyer_radar_clients",          productLabel: "Buyer Radar",            handled: true },
  marketplace_lead_purchase:        { primaryTable: "marketplace_lead_locks",       productLabel: "Marketplace Lead",       handled: true },
  wire_subscription:                { primaryTable: "wire_subscribers",             productLabel: "Wire",                   handled: true },
  site_radar_subscription:          { primaryTable: "field_crm_clients",            productLabel: "SiteRadar",              handled: true },
  missed_call_subscription:         { primaryTable: "missed_call_clients",          productLabel: "Missed-Call Catch",      handled: true },
  field_crm_subscription:           { primaryTable: "field_crm_clients",            productLabel: "FieldDesk",              handled: true },
  contractor_lead_subscription:     { primaryTable: "contractor_lead_sites",        productLabel: "Contractor Leads",       handled: true },
  dead_lead_billing_setup:          { primaryTable: "dead_lead_campaigns",          productLabel: "Dead Lead Reactivation", handled: true },
  dead_lead_pilot:                  { primaryTable: "dead_lead_campaigns",          productLabel: "Dead Lead Pilot",        handled: true },
  trade_radar_subscription:         { primaryTable: "trade_radar_clients",          productLabel: "Trade Radar",            handled: true },
  bundle_revenue_suite:             { primaryTable: "checkout_events",              productLabel: "Bundle Revenue Suite",   handled: true },
  gbp_subscription:                 { primaryTable: "gbp_saas_clients",             productLabel: "GBP SaaS",               handled: true },
  social_media_subscription:        { primaryTable: "social_media_clients",         productLabel: "Social Media",           handled: true },
  phone_answering_subscription:     { primaryTable: "checkout_events",              productLabel: "AI Phone Answering",     handled: true },
  reputation_dashboard_subscription:{ primaryTable: "checkout_events",              productLabel: "Reputation Dashboard",   handled: true },
  ads_copy_subscription:            { primaryTable: "checkout_events",              productLabel: "Ads Copy",               handled: true },
};

/**
 * Resolve which DB table a checkout.session.completed event targets.
 * Returns `handled: false` for unknown/unregistered types.
 */
export function resolveRoute(metaType: string | undefined | null): RouteDecision {
  if (!metaType) {
    return { primaryTable: "checkout_events", productLabel: "Unknown", handled: false };
  }
  return ROUTES[metaType] ?? { primaryTable: "checkout_events", productLabel: metaType, handled: false };
}

/** All registered meta.type values that have explicit handlers. */
export const HANDLED_TYPES = Object.keys(ROUTES);
