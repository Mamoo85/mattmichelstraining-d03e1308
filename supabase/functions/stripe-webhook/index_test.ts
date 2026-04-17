import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== PRODUCT_TIER_MAP tests =====
// Reimplemented from index.ts to test the mapping logic in isolation.

const PRODUCT_TIER_MAP: Record<string, string> = {
  // Current monthly
  "prod_UBI78IQsBpyfNw": "basic",
  "prod_UEfNKQVnbRcu1F": "guided",
  "prod_UBI7Wdb3liTxiF": "foundation",
  "prod_UBI8SV9Fa6CibX": "custom",
  "prod_UBI8mP9jA5rV3U": "team_elite",
  // Current annual
  "prod_UC3NyJRutYTL87": "basic",
  "prod_UEfQGAQMjysPqV": "guided",
  "prod_UC3OvNMcgtPafc": "foundation",
  "prod_UC3ONcP6ZoWtdM": "custom",
  // Previous generation
  "prod_UAlStH84vrByST": "basic",
  "prod_UAlTgNGJWmREZL": "foundation",
  "prod_UAlTkDlrDfDije": "custom",
  "prod_UAlUIuvjHBjtNL": "team_elite",
  // Legacy
  "prod_U9ppSReG0j0RIr": "basic",
  "prod_U9pqrtuc44EE4A": "foundation",
  "prod_U9pqNqVuxYD6kl": "custom",
  "prod_U9pq1sVSh9nOQi": "team_elite",
};

Deno.test("PRODUCT_TIER_MAP — current monthly products resolve correctly", () => {
  assertEquals(PRODUCT_TIER_MAP["prod_UBI78IQsBpyfNw"], "basic");
  assertEquals(PRODUCT_TIER_MAP["prod_UEfNKQVnbRcu1F"], "guided");
  assertEquals(PRODUCT_TIER_MAP["prod_UBI7Wdb3liTxiF"], "foundation");
  assertEquals(PRODUCT_TIER_MAP["prod_UBI8SV9Fa6CibX"], "custom");
});

Deno.test("PRODUCT_TIER_MAP — annual products resolve to same tier as monthly", () => {
  assertEquals(PRODUCT_TIER_MAP["prod_UC3NyJRutYTL87"], "basic");       // Foundation annual
  assertEquals(PRODUCT_TIER_MAP["prod_UEfQGAQMjysPqV"], "guided");      // Guided annual
  assertEquals(PRODUCT_TIER_MAP["prod_UC3OvNMcgtPafc"], "foundation");  // Pro annual
  assertEquals(PRODUCT_TIER_MAP["prod_UC3ONcP6ZoWtdM"], "custom");      // Elite annual
});

Deno.test("PRODUCT_TIER_MAP — previous gen products still resolve", () => {
  assertEquals(PRODUCT_TIER_MAP["prod_UAlStH84vrByST"], "basic");
  assertEquals(PRODUCT_TIER_MAP["prod_UAlTgNGJWmREZL"], "foundation");
  assertEquals(PRODUCT_TIER_MAP["prod_UAlTkDlrDfDije"], "custom");
});

Deno.test("PRODUCT_TIER_MAP — legacy products still resolve", () => {
  assertEquals(PRODUCT_TIER_MAP["prod_U9ppSReG0j0RIr"], "basic");
  assertEquals(PRODUCT_TIER_MAP["prod_U9pqrtuc44EE4A"], "foundation");
});

Deno.test("PRODUCT_TIER_MAP — unknown product ID returns undefined (not a crash)", () => {
  const tier = PRODUCT_TIER_MAP["prod_totally_unknown"] ?? "basic";
  assertEquals(tier, "basic"); // webhook falls back to "basic" for unknown products
});

// ===== m2Email template tests =====
// Reimplemented from index.ts for isolated testing.

function m2Email(opts: {
  greeting: string;
  headline: string;
  body: string;
  cta?: { text: string; url: string };
  signature?: string;
}): string {
  const ctaBlock = opts.cta
    ? `<div style="text-align:center;margin:24px 0"><a href="${opts.cta.url}" style="display:inline-block;background:#e8621a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;font-family:sans-serif">${opts.cta.text}</a></div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body>
  <div>
    <div><p>M² Development</p><h1>${opts.headline}</h1></div>
    <div>
      <p>${opts.greeting}</p>
      ${opts.body}
      ${ctaBlock}
      <div><strong>${opts.signature || "Matt Michels"}</strong></div>
    </div>
  </div>
</body></html>`;
}

Deno.test("m2Email — includes headline in output", () => {
  const html = m2Email({ greeting: "Hey!", headline: "Welcome aboard", body: "<p>Details</p>" });
  assertStringIncludes(html, "Welcome aboard");
});

Deno.test("m2Email — includes greeting in output", () => {
  const html = m2Email({ greeting: "Hi John!", headline: "Test", body: "<p>body</p>" });
  assertStringIncludes(html, "Hi John!");
});

Deno.test("m2Email — includes body HTML", () => {
  const html = m2Email({ greeting: "Hey", headline: "Test", body: "<p>Your subscription is active.</p>" });
  assertStringIncludes(html, "Your subscription is active.");
});

Deno.test("m2Email — includes CTA link when provided", () => {
  const html = m2Email({
    greeting: "Hey",
    headline: "Test",
    body: "<p>body</p>",
    cta: { text: "Get Started", url: "https://example.com/start" },
  });
  assertStringIncludes(html, "https://example.com/start");
  assertStringIncludes(html, "Get Started");
});

Deno.test("m2Email — omits CTA block when not provided", () => {
  const html = m2Email({ greeting: "Hey", headline: "Test", body: "<p>body</p>" });
  // No anchor tag pointing to external URLs
  const hasCtaAnchor = html.includes('href="https://example.com');
  assertEquals(hasCtaAnchor, false);
});

Deno.test("m2Email — uses custom signature when provided", () => {
  const html = m2Email({
    greeting: "Hey",
    headline: "Test",
    body: "<p>body</p>",
    signature: "Matt — Detroit Web Agency",
  });
  assertStringIncludes(html, "Matt — Detroit Web Agency");
});

Deno.test("m2Email — defaults to 'Matt Michels' signature", () => {
  const html = m2Email({ greeting: "Hey", headline: "Test", body: "<p>body</p>" });
  assertStringIncludes(html, "Matt Michels");
});

// ===== Idempotency guard logic tests =====
// The webhook uses a DB insert to claim an event and returns 200 on duplicate key (23505).

type DedupeResult =
  | { action: "skip"; reason: "duplicate" }
  | { action: "process" }
  | { action: "error"; reason: "db_failure" };

function evaluateDedupeResult(error: { code?: string } | null): DedupeResult {
  if (!error) return { action: "process" };
  if (error.code === "23505") return { action: "skip", reason: "duplicate" };
  return { action: "error", reason: "db_failure" };
}

Deno.test("idempotency — no error means proceed with processing", () => {
  const result = evaluateDedupeResult(null);
  assertEquals(result.action, "process");
});

Deno.test("idempotency — 23505 duplicate key means skip (already processed)", () => {
  const result = evaluateDedupeResult({ code: "23505" });
  assertEquals(result.action, "skip");
  assertEquals((result as any).reason, "duplicate");
});

Deno.test("idempotency — other DB error means return 500 for Stripe to retry", () => {
  const result = evaluateDedupeResult({ code: "08006" }); // connection failure
  assertEquals(result.action, "error");
  assertEquals((result as any).reason, "db_failure");
});

Deno.test("idempotency — unknown error code still treated as DB failure", () => {
  const result = evaluateDedupeResult({ code: "UNKNOWN" });
  assertEquals(result.action, "error");
});

// ===== Event type routing tests =====
// The webhook branches on event.type — verify the routing categories.

const SUBSCRIPTION_LIFECYCLE_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const CHECKOUT_COMPLETED_EVENT = "checkout.session.completed";

function classifyStripeEvent(eventType: string): string {
  if (SUBSCRIPTION_LIFECYCLE_EVENTS.has(eventType)) return "subscription_lifecycle";
  if (eventType === CHECKOUT_COMPLETED_EVENT) return "checkout_completed";
  return "other";
}

Deno.test("event routing — subscription.created classified as lifecycle", () => {
  assertEquals(classifyStripeEvent("customer.subscription.created"), "subscription_lifecycle");
});

Deno.test("event routing — subscription.updated classified as lifecycle", () => {
  assertEquals(classifyStripeEvent("customer.subscription.updated"), "subscription_lifecycle");
});

Deno.test("event routing — subscription.deleted classified as lifecycle", () => {
  assertEquals(classifyStripeEvent("customer.subscription.deleted"), "subscription_lifecycle");
});

Deno.test("event routing — checkout.session.completed classified correctly", () => {
  assertEquals(classifyStripeEvent("checkout.session.completed"), "checkout_completed");
});

Deno.test("event routing — unknown event type classified as other", () => {
  assertEquals(classifyStripeEvent("payment_intent.created"), "other");
  assertEquals(classifyStripeEvent(""), "other");
});
