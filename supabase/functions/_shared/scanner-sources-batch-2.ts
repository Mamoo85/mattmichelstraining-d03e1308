// Production Batch 2 — Property-data sources wired against the ingestion framework.
//
// Sources in this batch:
//   • ATTOM Property Data API     (Tier-S #1 — mortgage_radar + trade_radar + dead_lead_pool)
//   • RentCast Sales & Rental API (Tier-S #2 — mortgage_radar + channel_prospector)
//
// Both require an API key in Supabase Edge Function secrets:
//   ATTOM_API_KEY      — https://api.developer.attomdata.com/  (free dev tier: 1k/day)
//   RENTCAST_API_KEY   — https://app.rentcast.io/app/api       (free dev tier: 50/mo)
//
// If a key is missing, the source fails fast with an "AUTH / no_key" error code —
// the dispatcher logs it and moves on; the framework never crashes.
//
// Volume strategy: ATTOM is the single biggest gap-filler for equity/owner data.
// We rotate through a configurable list of MI zip codes per run so we cover the
// full state across the daily cron window without burning the free tier.

import { defineSource } from "./source-framework.ts";

// Default Michigan target zips — covers SE MI metros + Grand Rapids + Lansing + UP gateways.
// Override at runtime by setting SCANNER_PROPERTY_ZIPS env var (comma-separated).
const DEFAULT_MI_ZIPS = [
  "48201", "48226", "48202", "48207", "48214", // Detroit core
  "48104", "48105", "48108",                    // Ann Arbor
  "48823", "48864",                              // East Lansing / Okemos
  "49503", "49505", "49506",                    // Grand Rapids
  "48084", "48085",                              // Troy
  "48073", "48067",                              // Royal Oak
  "48009",                                       // Birmingham
];

function getRotatingZip(): string {
  const override = Deno.env.get("SCANNER_PROPERTY_ZIPS");
  const zips = override ? override.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_MI_ZIPS;
  // Rotate by day-of-year so each daily run covers a different slice.
  const day = Math.floor(Date.now() / 86_400_000);
  return zips[day % zips.length];
}

function requireKey(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`AUTH: ${name} not configured (no api key)`);
  return v;
}

// ─── Tier-S #1: ATTOM Property Data — Owner / Equity / AVM ────────────────
// Pulls property snapshots for a rotating MI zip. Each row carries owner of
// record, last sale, AVM, mortgage estimate → richest mortgage_radar signal.
export const attomPropertySnapshot = defineSource({
  slug: "attom_property_snapshot",
  product: "mortgage_radar",
  host: "api.gateway.attomdata.com",
  rps: 1, // ATTOM dev tier is 5 rps; stay conservative.
  fetch: async (ctx) => {
    const key = requireKey("ATTOM_API_KEY");
    const zip = getRotatingZip();
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?postalcode=${zip}&pagesize=100`;
    return await ctx.fetchJson<{ property?: unknown[] }>(url, {
      headers: { apikey: key, Accept: "application/json" },
    });
  },
  extractRows: (payload) => (payload?.property ?? []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, any>;
    const addr = r.address ?? {};
    const sale = r.sale ?? {};
    const owner = r.owner?.owner1 ?? r.owner ?? {};
    const assessment = r.assessment ?? {};
    const avm = r.avm?.amount ?? {};
    return {
      external_id: r.identifier?.attomId ?? r.identifier?.Id,
      address: addr.line1 ?? addr.oneLine,
      city: addr.locality,
      state: addr.countrySubd,
      zip: addr.postal1,
      county: addr.countrySecSubd,
      lat: r.location?.latitude,
      lon: r.location?.longitude,
      full_name: [owner.firstNameAndMi, owner.lastName].filter(Boolean).join(" ") || owner.fullName,
      occurred_at: sale.saleSearchDate ?? sale.transactionIdent?.contractDate,
      estimated_value: avm.value ?? assessment.market?.mktTtlValue,
      title: "ATTOM property snapshot",
      description: `Owner-of-record + AVM for ${addr.postal1}. AVM $${avm.value ?? "?"}`,
    };
  },
});

// ─── Tier-S #2: RentCast Sale Listings (off-market + distressed) ──────────
// Per-zip recent listings with price drops / DOM > 60 = distressed signal.
export const rentcastSaleListings = defineSource({
  slug: "rentcast_sale_listings",
  product: "mortgage_radar",
  host: "api.rentcast.io",
  rps: 1, // free tier: 50/mo total — generous floor
  fetch: async (ctx) => {
    const key = requireKey("RENTCAST_API_KEY");
    const zip = getRotatingZip();
    const url = `https://api.rentcast.io/v1/listings/sale?zipCode=${zip}&status=Active&limit=50`;
    return await ctx.fetchJson<unknown[]>(url, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
    });
  },
  extractRows: (payload) => (Array.isArray(payload) ? payload : []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, any>;
    return {
      external_id: r.id ?? r.listingId ?? `${r.formattedAddress}-${r.listedDate}`,
      address: r.formattedAddress ?? r.addressLine1,
      city: r.city,
      state: r.state,
      zip: r.zipCode,
      county: r.county,
      lat: r.latitude,
      lon: r.longitude,
      occurred_at: r.listedDate ?? r.lastSeenDate,
      estimated_value: r.price,
      title: `RentCast sale listing — ${r.propertyType ?? "SFR"}`,
      description: `Price $${r.price ?? "?"}, DOM ${r.daysOnMarket ?? "?"}, ${r.bedrooms ?? "?"}BR/${r.bathrooms ?? "?"}BA`,
      url: r.listingUrl,
    };
  },
});

// ─── RentCast Rental Listings (channel_prospector — landlord targeting) ───
export const rentcastRentalListings = defineSource({
  slug: "rentcast_rental_listings",
  product: "channel_prospector",
  host: "api.rentcast.io",
  rps: 1,
  fetch: async (ctx) => {
    const key = requireKey("RENTCAST_API_KEY");
    const zip = getRotatingZip();
    const url = `https://api.rentcast.io/v1/listings/rental/long-term?zipCode=${zip}&status=Active&limit=50`;
    return await ctx.fetchJson<unknown[]>(url, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
    });
  },
  extractRows: (payload) => (Array.isArray(payload) ? payload : []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, any>;
    return {
      external_id: r.id ?? r.listingId ?? `${r.formattedAddress}-${r.listedDate}`,
      address: r.formattedAddress ?? r.addressLine1,
      city: r.city,
      state: r.state,
      zip: r.zipCode,
      lat: r.latitude,
      lon: r.longitude,
      occurred_at: r.listedDate,
      estimated_value: r.price,
      title: `RentCast rental — $${r.price ?? "?"}/mo`,
      description: `${r.propertyType ?? "SFR"} ${r.bedrooms ?? "?"}BR — landlord lead`,
      url: r.listingUrl,
    };
  },
});

export const BATCH_2_SOURCES = [
  attomPropertySnapshot,
  rentcastSaleListings,
  rentcastRentalListings,
];

// Minimum row floor — if a single run returns fewer than this, the dispatcher
// will fire a warning into scanner_alerts so the DB never silently dries up.
// Tune per source; defaults assume daily cron, MI-only.
export const BATCH_2_MIN_ROWS: Record<string, number> = {
  attom_property_snapshot: 25,
  rentcast_sale_listings: 5,
  rentcast_rental_listings: 5,
};
