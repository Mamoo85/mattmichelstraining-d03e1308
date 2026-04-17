import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== Pricing logic tests =====
// Reimplemented from index.ts to test beta/standard pricing and metadata in isolation.

const BETA_LIMIT = 10;

interface PricingResult {
  unitAmount: number;
  pricingTier: string;
  planLabel: string;
}

function resolvePricing(
  plan: string,
  activeClients: number
): PricingResult {
  const resolvedPlan = plan === "bundle" ? "bundle" : "standalone";
  const isBeta = activeClients < BETA_LIMIT;
  let unitAmount: number;
  let pricingTier: string;

  if (resolvedPlan === "bundle") {
    unitAmount = isBeta ? 4900 : 7900;
    pricingTier = isBeta ? "beta_grandfathered" : "standard";
  } else {
    unitAmount = isBeta ? 9900 : 14900;
    pricingTier = isBeta ? "beta_grandfathered" : "standard";
  }

  const planLabel =
    resolvedPlan === "bundle"
      ? "Talent Radar + FieldDesk Bundle"
      : `Talent Radar — Statewide Michigan Hiring Monitor${isBeta ? " (Beta)" : ""}`;

  return { unitAmount, pricingTier, planLabel };
}

// ─── Standalone pricing ───────────────────────────────────────────────────────

Deno.test("pricing — standalone beta: $99/mo (9900 cents)", () => {
  const { unitAmount, pricingTier } = resolvePricing("standalone", 0);
  assertEquals(unitAmount, 9900);
  assertEquals(pricingTier, "beta_grandfathered");
});

Deno.test("pricing — standalone beta at limit boundary (9 clients)", () => {
  const { unitAmount } = resolvePricing("standalone", 9);
  assertEquals(unitAmount, 9900);
});

Deno.test("pricing — standalone standard at exactly BETA_LIMIT (10 clients): $149/mo", () => {
  const { unitAmount, pricingTier } = resolvePricing("standalone", 10);
  assertEquals(unitAmount, 14900);
  assertEquals(pricingTier, "standard");
});

Deno.test("pricing — standalone standard with many clients", () => {
  const { unitAmount, pricingTier } = resolvePricing("standalone", 50);
  assertEquals(unitAmount, 14900);
  assertEquals(pricingTier, "standard");
});

// ─── Bundle pricing ───────────────────────────────────────────────────────────

Deno.test("pricing — bundle beta: $49/mo (4900 cents)", () => {
  const { unitAmount, pricingTier } = resolvePricing("bundle", 0);
  assertEquals(unitAmount, 4900);
  assertEquals(pricingTier, "beta_grandfathered");
});

Deno.test("pricing — bundle standard: $79/mo (7900 cents)", () => {
  const { unitAmount, pricingTier } = resolvePricing("bundle", 10);
  assertEquals(unitAmount, 7900);
  assertEquals(pricingTier, "standard");
});

Deno.test("pricing — bundle is always cheaper than standalone at same tier", () => {
  const betaBundle = resolvePricing("bundle", 0).unitAmount;
  const betaStandalone = resolvePricing("standalone", 0).unitAmount;
  assertEquals(betaBundle < betaStandalone, true);

  const stdBundle = resolvePricing("bundle", 10).unitAmount;
  const stdStandalone = resolvePricing("standalone", 10).unitAmount;
  assertEquals(stdBundle < stdStandalone, true);
});

// ─── Plan label ───────────────────────────────────────────────────────────────

Deno.test("plan label — bundle has correct label", () => {
  const { planLabel } = resolvePricing("bundle", 0);
  assertStringIncludes(planLabel, "FieldDesk Bundle");
});

Deno.test("plan label — standalone beta includes '(Beta)' tag", () => {
  const { planLabel } = resolvePricing("standalone", 0);
  assertStringIncludes(planLabel, "(Beta)");
});

Deno.test("plan label — standalone standard does NOT include '(Beta)' tag", () => {
  const { planLabel } = resolvePricing("standalone", 10);
  assertEquals(planLabel.includes("(Beta)"), false);
});

Deno.test("plan label — standalone includes Michigan branding", () => {
  const { planLabel } = resolvePricing("standalone", 0);
  assertStringIncludes(planLabel, "Michigan");
});

// ─── Unknown plan defaults to standalone ─────────────────────────────────────

Deno.test("pricing — unknown plan value defaults to standalone pricing", () => {
  const { unitAmount } = resolvePricing("enterprise", 0); // not "bundle"
  assertEquals(unitAmount, 9900); // beta standalone
});

Deno.test("pricing — empty plan value defaults to standalone", () => {
  const { unitAmount } = resolvePricing("", 5);
  assertEquals(unitAmount, 9900);
});

// ─── Metadata construction ────────────────────────────────────────────────────

interface CheckoutMeta {
  type: string;
  plan: string;
  pricing_tier: string;
  email: string;
  company_name: string;
  owner_phone: string;
  target_roles: string;
  ref: string;
  county: string;
  tos_accepted: string;
}

function buildMetadata(params: {
  email: string;
  plan: string;
  pricingTier: string;
  companyName?: string;
  phone?: string;
  targetRoles?: string[];
  ref?: string;
  county?: string;
}): CheckoutMeta {
  return {
    type: "hire_alert_subscription",
    plan: params.plan === "bundle" ? "bundle" : "standalone",
    pricing_tier: params.pricingTier,
    email: params.email,
    company_name: params.companyName || "",
    owner_phone: params.phone || "",
    target_roles:
      Array.isArray(params.targetRoles) && params.targetRoles.length
        ? params.targetRoles.join(",")
        : "boiler_operator,hvac_tech",
    ref: params.ref || "direct",
    county: params.county || "",
    tos_accepted: "true",
  };
}

Deno.test("metadata — type is always 'hire_alert_subscription'", () => {
  const meta = buildMetadata({ email: "a@b.com", plan: "standalone", pricingTier: "standard" });
  assertEquals(meta.type, "hire_alert_subscription");
});

Deno.test("metadata — tos_accepted is always 'true'", () => {
  const meta = buildMetadata({ email: "a@b.com", plan: "standalone", pricingTier: "beta_grandfathered" });
  assertEquals(meta.tos_accepted, "true");
});

Deno.test("metadata — target_roles defaults to boiler_operator,hvac_tech when not provided", () => {
  const meta = buildMetadata({ email: "a@b.com", plan: "standalone", pricingTier: "standard" });
  assertEquals(meta.target_roles, "boiler_operator,hvac_tech");
});

Deno.test("metadata — custom target_roles joined as comma-separated string", () => {
  const meta = buildMetadata({
    email: "a@b.com",
    plan: "standalone",
    pricingTier: "standard",
    targetRoles: ["hvac_tech", "boiler_operator", "electrician"],
  });
  assertEquals(meta.target_roles, "hvac_tech,boiler_operator,electrician");
});

Deno.test("metadata — ref defaults to 'direct'", () => {
  const meta = buildMetadata({ email: "a@b.com", plan: "standalone", pricingTier: "standard" });
  assertEquals(meta.ref, "direct");
});

Deno.test("metadata — custom ref is preserved", () => {
  const meta = buildMetadata({
    email: "a@b.com",
    plan: "standalone",
    pricingTier: "standard",
    ref: "tom_outreach",
  });
  assertEquals(meta.ref, "tom_outreach");
});

Deno.test("metadata — company_name and phone default to empty string", () => {
  const meta = buildMetadata({ email: "a@b.com", plan: "standalone", pricingTier: "standard" });
  assertEquals(meta.company_name, "");
  assertEquals(meta.owner_phone, "");
});

// ─── Email validation ─────────────────────────────────────────────────────────

function validateCheckoutInput(body: Record<string, unknown>): string | null {
  if (!body.email) return "email is required";
  return null;
}

Deno.test("validation — missing email returns error message", () => {
  assertEquals(validateCheckoutInput({}), "email is required");
  assertEquals(validateCheckoutInput({ email: "" }), "email is required");
});

Deno.test("validation — present email returns null (no error)", () => {
  assertEquals(validateCheckoutInput({ email: "test@example.com" }), null);
});
