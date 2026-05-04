// Tests for stripe-webhook routing table.
// Verifies that every registered metadata.type maps to the correct DB table
// so regressions in product provisioning are caught before they hit production.
// Run: deno test supabase/functions/stripe-webhook/router.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveRoute, HANDLED_TYPES } from "./router.ts";

// ── Null / undefined / empty type ─────────────────────────────────────────────

Deno.test("resolveRoute: null meta.type → handled=false", () => {
  const r = resolveRoute(null);
  assertEquals(r.handled, false);
});

Deno.test("resolveRoute: undefined meta.type → handled=false", () => {
  const r = resolveRoute(undefined);
  assertEquals(r.handled, false);
});

Deno.test("resolveRoute: empty string meta.type → handled=false", () => {
  const r = resolveRoute("");
  assertEquals(r.handled, false);
});

Deno.test("resolveRoute: unknown type → handled=false, primaryTable=checkout_events", () => {
  const r = resolveRoute("totally_unknown_product");
  assertEquals(r.handled, false);
  assertEquals(r.primaryTable, "checkout_events");
});

// ── Revenue-critical products → correct primary tables ────────────────────────

Deno.test("resolveRoute: hire_alert_subscription → hire_alert_clients", () => {
  const r = resolveRoute("hire_alert_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "hire_alert_clients");
});

Deno.test("resolveRoute: mortgage_radar_subscription → mortgage_radar_clients", () => {
  const r = resolveRoute("mortgage_radar_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "mortgage_radar_clients");
});

Deno.test("resolveRoute: mortgage_radar_trial → mortgage_radar_clients", () => {
  const r = resolveRoute("mortgage_radar_trial");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "mortgage_radar_clients");
});

Deno.test("resolveRoute: field_crm_subscription → field_crm_clients (FieldDesk)", () => {
  const r = resolveRoute("field_crm_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "field_crm_clients");
  assert(r.productLabel.toLowerCase().includes("fielddesk"), `Expected FieldDesk label, got: ${r.productLabel}`);
});

Deno.test("resolveRoute: site_radar_subscription → field_crm_clients (SiteRadar uses same table)", () => {
  const r = resolveRoute("site_radar_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "field_crm_clients");
});

Deno.test("resolveRoute: missed_call_subscription → missed_call_clients", () => {
  const r = resolveRoute("missed_call_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "missed_call_clients");
});

Deno.test("resolveRoute: contractor_lead_subscription → contractor_lead_sites", () => {
  const r = resolveRoute("contractor_lead_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "contractor_lead_sites");
});

Deno.test("resolveRoute: dead_lead_billing_setup → dead_lead_campaigns", () => {
  const r = resolveRoute("dead_lead_billing_setup");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "dead_lead_campaigns");
});

Deno.test("resolveRoute: dead_lead_pilot → dead_lead_campaigns", () => {
  const r = resolveRoute("dead_lead_pilot");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "dead_lead_campaigns");
});

Deno.test("resolveRoute: trade_radar_subscription → trade_radar_clients", () => {
  const r = resolveRoute("trade_radar_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "trade_radar_clients");
});

Deno.test("resolveRoute: marketplace_lead_purchase → marketplace_lead_locks", () => {
  const r = resolveRoute("marketplace_lead_purchase");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "marketplace_lead_locks");
});

Deno.test("resolveRoute: buyer_radar_subscription → buyer_radar_clients", () => {
  const r = resolveRoute("buyer_radar_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "buyer_radar_clients");
});

Deno.test("resolveRoute: wire_subscription → wire_subscribers", () => {
  const r = resolveRoute("wire_subscription");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "wire_subscribers");
});

Deno.test("resolveRoute: techalert_pay_per_hire → hire_alert_clients", () => {
  const r = resolveRoute("techalert_pay_per_hire");
  assertEquals(r.handled, true);
  assertEquals(r.primaryTable, "hire_alert_clients");
});

// ── HANDLED_TYPES completeness ────────────────────────────────────────────────

Deno.test("HANDLED_TYPES: every listed type resolves with handled=true", () => {
  for (const t of HANDLED_TYPES) {
    const r = resolveRoute(t);
    assertEquals(r.handled, true, `Expected handled=true for "${t}", got false`);
  }
});

Deno.test("HANDLED_TYPES: every listed type has a non-empty primaryTable", () => {
  for (const t of HANDLED_TYPES) {
    const r = resolveRoute(t);
    assert(r.primaryTable.length > 0, `Empty primaryTable for "${t}"`);
  }
});

Deno.test("HANDLED_TYPES: every listed type has a non-empty productLabel", () => {
  for (const t of HANDLED_TYPES) {
    const r = resolveRoute(t);
    assert(r.productLabel.length > 0, `Empty productLabel for "${t}"`);
  }
});

Deno.test("HANDLED_TYPES: no duplicate entries", () => {
  const unique = new Set(HANDLED_TYPES);
  assertEquals(unique.size, HANDLED_TYPES.length, "Duplicate entries found in HANDLED_TYPES");
});

// ── Route shape invariants ────────────────────────────────────────────────────

Deno.test("resolveRoute: always returns an object with handled, primaryTable, productLabel", () => {
  for (const t of [...HANDLED_TYPES, "unknown_type", "", null as unknown as string]) {
    const r = resolveRoute(t);
    assert("handled" in r, `Missing 'handled' for "${t}"`);
    assert("primaryTable" in r, `Missing 'primaryTable' for "${t}"`);
    assert("productLabel" in r, `Missing 'productLabel' for "${t}"`);
  }
});
