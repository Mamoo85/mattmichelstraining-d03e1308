// intake-throttle.ts — Right-size every scanner to active customer count.
// Prevents both extremes: dead pools (dead_lead_contacts=0) and bloat.
//
// Usage at the top of any scanner's serve() handler:
//   const gate = await shouldScanMore(sb, "trade_radar", { vertical: "roofing" });
//   if (gate.skip) {
//     return new Response(JSON.stringify({ skipped: true, reason: gate.reason }), ...);
//   }

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProductKey =
  | "trade_radar"
  | "mortgage_radar"
  | "techalert"
  | "contractor_leads"
  | "marketplace"
  | "dead_lead_pool";

interface ProductConfig {
  table: string;
  freshColumn: string;          // e.g. created_at
  freshDays: number;            // how recent counts as "fresh"
  excludeStatuses?: string[];   // rows in these statuses don't count toward inventory
  customerTable?: string;       // null => use static expectedCustomers
  customerActiveCol?: string;
  perCustomerPerWeek: number;   // target leads per active customer per week
  minFloor: number;             // never go below this
  cap: number;                  // never exceed this
  verticalColumn?: string;      // for trade_radar etc.
}

const CONFIGS: Record<ProductKey, ProductConfig> = {
  trade_radar: {
    table: "trade_radar_leads",
    freshColumn: "created_at",
    freshDays: 7,
    customerTable: "trade_radar_clients",
    customerActiveCol: "active",
    perCustomerPerWeek: 25,
    minFloor: 50,
    cap: 500,
    verticalColumn: "vertical",
  },
  mortgage_radar: {
    table: "mortgage_radar_leads",
    freshColumn: "last_signal_at",
    freshDays: 1,
    customerTable: "mortgage_radar_clients",
    customerActiveCol: "active",
    perCustomerPerWeek: 40,
    minFloor: 20,
    cap: 600,
  },
  techalert: {
    table: "techalert_prospect_targets",
    freshColumn: "first_seen_at",
    freshDays: 14,
    excludeStatuses: ["exhausted", "do_not_contact"],
    customerTable: "hire_alert_clients",
    customerActiveCol: "active",
    perCustomerPerWeek: 30,
    minFloor: 75,
    cap: 300,
  },
  contractor_leads: {
    table: "contractor_leads",
    freshColumn: "created_at",
    freshDays: 7,
    customerTable: "contractor_clients",
    customerActiveCol: "active",
    perCustomerPerWeek: 20,
    minFloor: 30,
    cap: 200,
  },
  marketplace: {
    table: "marketplace_prospects",
    freshColumn: "created_at",
    freshDays: 14,
    excludeStatuses: ["sold", "expired"],
    perCustomerPerWeek: 0, // not customer-driven
    minFloor: 40,
    cap: 250,
  },
  dead_lead_pool: {
    table: "dead_lead_master_pool",
    freshColumn: "added_at",
    freshDays: 30,
    excludeStatuses: ["claimed", "burned"],
    perCustomerPerWeek: 25,
    minFloor: 50,
    cap: 300,
  },
};

export interface ThrottleResult {
  skip: boolean;
  reason: string;
  fresh: number;
  target: number;
  activeCustomers: number;
}

export async function shouldScanMore(
  sb: SupabaseClient,
  product: ProductKey,
  opts: { vertical?: string; force?: boolean } = {},
): Promise<ThrottleResult> {
  const cfg = CONFIGS[product];
  if (!cfg) {
    return { skip: false, reason: "unknown_product", fresh: 0, target: 0, activeCustomers: 0 };
  }
  if (opts.force) {
    return { skip: false, reason: "forced", fresh: 0, target: cfg.cap, activeCustomers: 0 };
  }

  // Count fresh inventory
  const since = new Date(Date.now() - cfg.freshDays * 86400_000).toISOString();
  let q: any = sb.from(cfg.table as any).select("id", { count: "exact", head: true }).gte(cfg.freshColumn, since);
  if (cfg.excludeStatuses?.length) {
    q = q.not("status", "in", `(${cfg.excludeStatuses.map((s) => `"${s}"`).join(",")})`);
  }
  if (opts.vertical && cfg.verticalColumn) {
    q = q.eq(cfg.verticalColumn, opts.vertical);
  }
  const { count: fresh } = await q;

  // Count active customers
  let activeCustomers = 0;
  if (cfg.customerTable) {
    let cq: any = sb.from(cfg.customerTable as any).select("id", { count: "exact", head: true });
    if (cfg.customerActiveCol) cq = cq.eq(cfg.customerActiveCol, true);
    if (opts.vertical && cfg.verticalColumn) cq = cq.eq(cfg.verticalColumn, opts.vertical);
    const { count } = await cq;
    activeCustomers = count || 0;
  }

  const target = Math.max(
    cfg.minFloor,
    Math.min(cfg.cap, activeCustomers * cfg.perCustomerPerWeek),
  );
  const have = fresh || 0;

  if (have >= cfg.cap) {
    return { skip: true, reason: `at_cap_${cfg.cap}`, fresh: have, target, activeCustomers };
  }
  if (have >= target) {
    return { skip: true, reason: `inventory_sufficient`, fresh: have, target, activeCustomers };
  }
  return { skip: false, reason: "scan", fresh: have, target, activeCustomers };
}
