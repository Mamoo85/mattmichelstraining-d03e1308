import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== checkout.session.completed routing tests =====
//
// The stripe-webhook dispatches on meta.type inside checkout.session.completed.
// Each handler returns early so only ONE fires per event.
// These tests verify:
//   1. Every revenue-critical type maps to exactly one target table/handler.
//   2. No two types accidentally share a handler (collision detection).
//   3. Missing/unknown types produce predictable outcomes.
//   4. Handlers with hard required fields reject missing metadata at correct status.
//   5. Idempotency guards work for the contractor PPL flow.

// ─── Routing registry ────────────────────────────────────────────────────────
// Mirrors the if-chain in index.ts. Update this map when adding new handlers.
// value = DB table or handler identifier that the type provisions into.

const CHECKOUT_ROUTING: Record<string, string> = {
  training_session:               "session_bookings",
  gift_card:                      "gift_cards",
  web_design_addon:               "client_addons",
  handbook_subscription:          "handbook_clients",
  wire_subscription:              "wire_subscribers",
  hire_alert_subscription:        "hire_alert_clients",
  industry_pulse_subscription:    "industry_pulse_clients",
  grant_finder_subscription:      "grant_finder_clients",
  review_response_subscription:   "review_response_clients",
  battlecard_subscription:        "battlecard_clients",
  market_intel_subscription:      "market_intel_clients",
  caption_pack_subscription:      "caption_pack_clients",
  gov_contract_monitor:           "gov_contract_monitor_clients",
  reg_filing_monitor:             "reg_filing_clients",
  bid_intel_monitor:              "bid_intel_clients",
  regulatory_monitor:             "regulatory_monitor_clients",
  trademark_watch:                "trademark_watch_clients",
  faq_refresh_subscription:       "faq_refresh_clients",
  job_posting_subscription:       "job_posting_clients",
  newsletter_service_subscription:"newsletter_service_clients",
  re_newsletter:                  "real_estate_newsletter_clients",
  field_crm_subscription:         "field_crm_clients",
  pet_memorial:                   "pet_memorial_clients",
  interactive_program:            "training_programs",
  competitor_pricing:             "competitor_pricing_clients",
  podcast_revenue_machine:        "podcast_revenue_clients",
  license_monitor_subscription:   "license_monitor_clients",
  tech_support_session:           "tech_support_tickets",
  sport_guide:                    "sport_guide_purchases",
  nutrition_plan:                 "nutrition_plan_clients",
  seo_package:                    "seo_leads",
  audit_report:                   "audit_report_requests",
  gbp_subscription:               "gbp_saas_clients",
  camp_listing:                   "camp_listings",
  web_design_build:               "web_design_leads",
  web_design_retainer:            "web_design_retainer_clients",
  pdf_guide:                      "guide_purchases",
  contractor_lead_payment:        "contractor_lead_purchases",
};

// ─── No duplicate target tables ───────────────────────────────────────────────

Deno.test("routing registry — no two types provision into the same table", () => {
  const tables = Object.values(CHECKOUT_ROUTING);
  const unique = new Set(tables);
  const duplicates = tables.filter((t, i) => tables.indexOf(t) !== i);
  assertEquals(duplicates, [], `Duplicate table targets: ${duplicates.join(", ")}`);
});

Deno.test("routing registry — every type key is a non-empty string", () => {
  for (const key of Object.keys(CHECKOUT_ROUTING)) {
    assertNotEquals(key, "");
    assertEquals(typeof key, "string");
  }
});

Deno.test("routing registry — all revenue-critical B2B types are present", () => {
  const required = [
    "hire_alert_subscription",
    "field_crm_subscription",
    "contractor_lead_payment",
    "wire_subscription",
    "handbook_subscription",
    "industry_pulse_subscription",
    "gov_contract_monitor",
    "gbp_subscription",
  ];
  for (const type of required) {
    assertEquals(
      type in CHECKOUT_ROUTING,
      true,
      `Missing critical type: ${type}`
    );
  }
});

// ─── Unknown / missing type falls through ────────────────────────────────────

function routeCheckout(metaType: string | undefined): string | null {
  if (!metaType) return null;
  return CHECKOUT_ROUTING[metaType] ?? null;
}

Deno.test("routing — unknown meta.type returns null (no provisioning)", () => {
  assertEquals(routeCheckout("totally_made_up_type"), null);
  assertEquals(routeCheckout(""), null);
  assertEquals(routeCheckout(undefined), null);
});

Deno.test("routing — type matching is exact (no prefix/substring matches)", () => {
  // 'hire_alert' without '_subscription' should not match
  assertEquals(routeCheckout("hire_alert"), null);
  // 'field_crm' without '_subscription' should not match
  assertEquals(routeCheckout("field_crm"), null);
  // 'contractor_lead' without '_payment' should not match
  assertEquals(routeCheckout("contractor_lead"), null);
});

Deno.test("routing — all defined types resolve to a non-null table", () => {
  for (const type of Object.keys(CHECKOUT_ROUTING)) {
    assertNotEquals(routeCheckout(type), null, `Type ${type} unexpectedly returned null`);
  }
});

// ─── contractor_lead_payment required fields ─────────────────────────────────
// Missing lead_id or contractor_id must produce a 400 before any DB write.

interface PPLMeta {
  type: string;
  lead_id?: string;
  contractor_id?: string;
}

function validatePPLMetadata(meta: PPLMeta): { valid: boolean; status: number; error?: string } {
  if (meta.type !== "contractor_lead_payment") {
    return { valid: false, status: 400, error: "wrong type" };
  }
  if (!meta.lead_id || !meta.contractor_id) {
    return { valid: false, status: 400, error: "missing metadata" };
  }
  return { valid: true, status: 200 };
}

Deno.test("PPL — missing lead_id returns 400", () => {
  const result = validatePPLMetadata({ type: "contractor_lead_payment", contractor_id: "c-1" });
  assertEquals(result.status, 400);
  assertEquals(result.valid, false);
});

Deno.test("PPL — missing contractor_id returns 400", () => {
  const result = validatePPLMetadata({ type: "contractor_lead_payment", lead_id: "l-1" });
  assertEquals(result.status, 400);
  assertEquals(result.valid, false);
});

Deno.test("PPL — both fields present returns valid", () => {
  const result = validatePPLMetadata({
    type: "contractor_lead_payment",
    lead_id: "lead-uuid-123",
    contractor_id: "contractor-uuid-456",
  });
  assertEquals(result.valid, true);
  assertEquals(result.status, 200);
});

Deno.test("PPL — empty string fields treated as missing", () => {
  const result = validatePPLMetadata({
    type: "contractor_lead_payment",
    lead_id: "",
    contractor_id: "c-1",
  });
  assertEquals(result.valid, false);
  assertEquals(result.status, 400);
});

// ─── PPL idempotency guard ────────────────────────────────────────────────────
// If the lead is already sold with the same Stripe session ID, return 200 early
// without re-inserting into contractor_lead_purchases.

interface LeadState {
  status: string;
  payment_session_id: string | null;
}

function shouldSkipPPLProvision(lead: LeadState, incomingSessionId: string): boolean {
  return lead.status === "sold" && lead.payment_session_id === incomingSessionId;
}

Deno.test("PPL idempotency — same session + already sold = skip (200 early return)", () => {
  const lead: LeadState = { status: "sold", payment_session_id: "cs_abc123" };
  assertEquals(shouldSkipPPLProvision(lead, "cs_abc123"), true);
});

Deno.test("PPL idempotency — different session ID = do NOT skip (process normally)", () => {
  const lead: LeadState = { status: "sold", payment_session_id: "cs_other" };
  assertEquals(shouldSkipPPLProvision(lead, "cs_abc123"), false);
});

Deno.test("PPL idempotency — status is 'available' (not sold) = do NOT skip", () => {
  const lead: LeadState = { status: "available", payment_session_id: null };
  assertEquals(shouldSkipPPLProvision(lead, "cs_abc123"), false);
});

Deno.test("PPL idempotency — sold but null payment_session_id = do NOT skip", () => {
  const lead: LeadState = { status: "sold", payment_session_id: null };
  assertEquals(shouldSkipPPLProvision(lead, "cs_abc123"), false);
});

// ─── hire_alert_subscription required fields ──────────────────────────────────
// Must have email (from meta or customerEmail). target_roles defaults gracefully.

interface HireAlertMeta {
  email?: string;
  target_roles?: string;
  plan?: string;
  tos_accepted?: string;
}

function resolveHireAlertFields(meta: HireAlertMeta, customerEmail: string | null): {
  email: string | null;
  targetRoles: string[];
  plan: string;
  tosAcceptedAt: string | null;
} {
  const email = meta.email || customerEmail || null;
  const targetRoles = meta.target_roles
    ? meta.target_roles.split(",").map((r) => r.trim()).filter(Boolean)
    : ["boiler_operator", "hvac_tech"];
  const plan = meta.plan || "standalone";
  const tosAcceptedAt = meta.tos_accepted === "true" ? new Date().toISOString() : null;
  return { email, targetRoles, plan, tosAcceptedAt };
}

Deno.test("hire_alert — email falls back to customerEmail when meta.email absent", () => {
  const { email } = resolveHireAlertFields({}, "fallback@example.com");
  assertEquals(email, "fallback@example.com");
});

Deno.test("hire_alert — meta.email takes priority over customerEmail", () => {
  const { email } = resolveHireAlertFields({ email: "meta@example.com" }, "fallback@example.com");
  assertEquals(email, "meta@example.com");
});

Deno.test("hire_alert — null email when both absent", () => {
  const { email } = resolveHireAlertFields({}, null);
  assertEquals(email, null);
});

Deno.test("hire_alert — target_roles defaults to boiler_operator,hvac_tech", () => {
  const { targetRoles } = resolveHireAlertFields({}, null);
  assertEquals(targetRoles, ["boiler_operator", "hvac_tech"]);
});

Deno.test("hire_alert — target_roles parsed from comma-separated meta string", () => {
  const { targetRoles } = resolveHireAlertFields(
    { target_roles: "hvac_tech, boiler_operator, electrician" },
    null
  );
  assertEquals(targetRoles, ["hvac_tech", "boiler_operator", "electrician"]);
});

Deno.test("hire_alert — plan defaults to standalone", () => {
  const { plan } = resolveHireAlertFields({}, null);
  assertEquals(plan, "standalone");
});

Deno.test("hire_alert — tos_accepted=true sets tosAcceptedAt", () => {
  const { tosAcceptedAt } = resolveHireAlertFields({ tos_accepted: "true" }, null);
  assertNotEquals(tosAcceptedAt, null);
});

Deno.test("hire_alert — tos_accepted missing leaves tosAcceptedAt null", () => {
  const { tosAcceptedAt } = resolveHireAlertFields({}, null);
  assertEquals(tosAcceptedAt, null);
});

// ─── field_crm_subscription required fields ───────────────────────────────────
// customerEmail is required (checked in the if-condition itself).
// plan defaults to "standard", monthly_price depends on plan.

function resolveFieldCRMFields(meta: Record<string, string>, customerEmail: string | null): {
  shouldProvision: boolean;
  monthlyPrice: number;
  plan: string;
  industry: string;
} {
  const shouldProvision = !!customerEmail;
  const plan = meta.plan || "standard";
  const monthlyPrice = plan === "pro" ? 29900 : 19900;
  const industry = meta.industry || "hvac";
  return { shouldProvision, monthlyPrice, plan, industry };
}

Deno.test("field_crm — requires customerEmail to provision", () => {
  assertEquals(resolveFieldCRMFields({}, null).shouldProvision, false);
  assertEquals(resolveFieldCRMFields({}, "client@example.com").shouldProvision, true);
});

Deno.test("field_crm — standard plan = $199/mo (19900 cents)", () => {
  const { monthlyPrice } = resolveFieldCRMFields({ plan: "standard" }, "a@b.com");
  assertEquals(monthlyPrice, 19900);
});

Deno.test("field_crm — pro plan = $299/mo (29900 cents)", () => {
  const { monthlyPrice } = resolveFieldCRMFields({ plan: "pro" }, "a@b.com");
  assertEquals(monthlyPrice, 29900);
});

Deno.test("field_crm — plan defaults to standard when absent", () => {
  const { plan, monthlyPrice } = resolveFieldCRMFields({}, "a@b.com");
  assertEquals(plan, "standard");
  assertEquals(monthlyPrice, 19900);
});

Deno.test("field_crm — industry defaults to hvac when absent", () => {
  const { industry } = resolveFieldCRMFields({}, "a@b.com");
  assertEquals(industry, "hvac");
});
