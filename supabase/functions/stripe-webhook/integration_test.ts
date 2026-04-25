// Integration tests for the stripe-webhook handler.
//
// Strategy:
//   1. Set fake env vars BEFORE importing the handler so module-level
//      `getStripeSecretKey()` / `getStripeWebhookSecret()` succeed.
//   2. Stub `globalThis.fetch` to:
//        a) Capture every outbound HTTP call (Supabase REST, Resend, Twilio,
//           sibling Edge Function invocations).
//        b) Return canned responses so the handler completes synchronously
//           and we never touch the real network.
//   3. Build a real Stripe-signed `checkout.session.completed` payload using
//      the official Stripe SDK (the same one the handler uses to verify),
//      so signature verification passes end-to-end.
//   4. Call `handler(req)` directly and assert:
//        - HTTP 200 returned
//        - The fulfillment-specific HTTP calls fired (e.g. insert into
//          `hire_alert_clients`, invocation of `auto-onboard-client`, etc.)
//
// Covered top-5 products:
//   1. FieldDesk           → meta.type = field_service_subscription
//   2. TechAlert           → meta.type = hire_alert_subscription
//   3. Contractor Leads    → meta.type = contractor_lead_subscription
//   4. Missed-Call Catch   → meta.type = missed_call_subscription
//   5. Mortgage Radar      → meta.type = mortgage_radar_subscription

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

// ─── 1. Environment setup ────────────────────────────────────────────────
// `STRIPE_TEST_SECRET_KEY` + `STRIPE_TEST_WEBHOOK_SECRET` together activate
// test-mode in `_shared/stripe-key.ts`.
const TEST_WEBHOOK_SECRET = "whsec_test_integration_" + crypto.randomUUID().slice(0, 8);
Deno.env.set("STRIPE_TEST_SECRET_KEY", "sk_test_dummy_for_integration_tests");
Deno.env.set("STRIPE_TEST_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy_for_integration_tests");
Deno.env.set("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
Deno.env.set("SUPABASE_URL", "https://fake.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-fake");
Deno.env.set("SUPABASE_ANON_KEY", "anon-fake");
Deno.env.set("RESEND_API_KEY", "re_fake_integration");
Deno.env.set("TWILIO_ACCOUNT_SID", "AC_fake");
Deno.env.set("TWILIO_AUTH_TOKEN", "fake");
Deno.env.set("TWILIO_PHONE_NUMBER", "+15555550100");
Deno.env.set("ADMIN_PHONE", "+15555550199");

// ─── 2. Fetch capture ────────────────────────────────────────────────────
interface CapturedCall {
  url: string;
  method: string;
  body?: string;
}

let captured: CapturedCall[] = [];

const realFetch = globalThis.fetch;
function installFetchStub() {
  captured = [];
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input?.url ?? String(input);
    const method = (init?.method || (input?.method ?? "GET")).toUpperCase();
    let body: string | undefined;
    if (init?.body) {
      body = typeof init.body === "string" ? init.body : "[binary]";
    }
    captured.push({ url, method, body });

    // ── Idempotency insert into processed_stripe_events ──
    // Returning 201 (no error) lets the handler proceed to fulfillment.
    if (url.includes("/rest/v1/processed_stripe_events") && method === "POST") {
      return new Response(JSON.stringify([{ event_id: "evt_test" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── PATCH update on processed_stripe_events (markFulfilled) ──
    if (url.includes("/rest/v1/processed_stripe_events") && method === "PATCH") {
      return new Response("[]", { status: 200 });
    }

    // ── Resend email API ──
    if (url.includes("api.resend.com")) {
      return new Response(JSON.stringify({ id: "email_fake_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Twilio SMS API ──
    if (url.includes("api.twilio.com")) {
      return new Response(JSON.stringify({ sid: "SM_fake" }), { status: 201 });
    }

    // ── Sibling edge function invocations (auto-onboard-client, etc.) ──
    if (url.includes("/functions/v1/")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // ── Default Supabase REST: empty array ──
    if (url.includes("/rest/v1/")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Anything else → empty 200 ──
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// ─── 3. Signed Stripe payload helper ─────────────────────────────────────
// We build a real `checkout.session.completed` event and sign it the same
// way Stripe does so that `webhooks.constructEventAsync` succeeds.

const stripeForSigning = new Stripe("sk_test_dummy_for_integration_tests", {
  apiVersion: "2025-08-27.basil",
});

function buildCheckoutSessionCompletedEvent(meta: Record<string, string>, opts: {
  email?: string;
  customerId?: string;
  amount?: number;
} = {}): Stripe.Event {
  const session = {
    id: "cs_test_" + crypto.randomUUID().slice(0, 16),
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    status: "complete",
    amount_total: opts.amount ?? 19900,
    currency: "usd",
    customer: opts.customerId ?? "cus_test_fake",
    customer_email: opts.email ?? "buyer@example.com",
    customer_details: {
      email: opts.email ?? "buyer@example.com",
      name: "Test Buyer",
    },
    subscription: "sub_test_fake",
    metadata: meta,
    created: Math.floor(Date.now() / 1000),
  } as unknown as Stripe.Checkout.Session;

  const event: Stripe.Event = {
    id: "evt_test_" + crypto.randomUUID().slice(0, 16),
    object: "event",
    api_version: "2025-08-27.basil",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: session as any },
  } as Stripe.Event;
  return event;
}

async function buildSignedRequest(event: Stripe.Event): Promise<Request> {
  const payload = JSON.stringify(event);
  const header = await stripeForSigning.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: TEST_WEBHOOK_SECRET,
  });
  return new Request("https://fake.local/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": header,
    },
    body: payload,
  });
}

// ─── 4. Import handler AFTER env + fetch are stubbed ─────────────────────
// We want the module's top-level `serve(handler)` to be a no-op during tests.
// std/http/server.ts's `serve` will try to bind port 8000 — to avoid that we
// monkey-patch the std module's exports… but we can't intercept ESM.
// Workaround: import the module dynamically after installing the fetch stub
// and accept that a server will start. We stop it by setting `Deno.env`
// var `DENO_SERVE_PORT` won't help. Instead, we tolerate the port bind by
// running tests with --allow-net, and rely on the fact that we never make
// a request to that port.
installFetchStub();

const mod = await import("./index.ts");
const { handler } = mod as { handler: (r: Request) => Promise<Response> };

// ─── 5. Assertion helpers ────────────────────────────────────────────────
function callsMatching(predicate: (c: CapturedCall) => boolean): CapturedCall[] {
  return captured.filter(predicate);
}

function assertHitTable(table: string, method = "POST") {
  const hits = callsMatching(
    (c) => c.url.includes(`/rest/v1/${table}`) && c.method === method,
  );
  assert(
    hits.length > 0,
    `Expected at least one ${method} to /rest/v1/${table}, got ${hits.length}.\nCalls: ${captured
      .map((c) => `${c.method} ${c.url}`)
      .slice(0, 25)
      .join("\n")}`,
  );
}

function assertInvokedFunction(name: string) {
  const hits = callsMatching(
    (c) => c.url.includes(`/functions/v1/${name}`) && c.method === "POST",
  );
  assert(
    hits.length > 0,
    `Expected sibling function ${name} to be invoked. Captured: ${captured
      .map((c) => `${c.method} ${c.url}`)
      .slice(0, 25)
      .join("\n")}`,
  );
}

// ─── 6. The five tests ───────────────────────────────────────────────────

Deno.test({
  name: "integration — FieldDesk (field_service_subscription) fulfills",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    installFetchStub();
    const event = buildCheckoutSessionCompletedEvent(
      {
        type: "field_service_subscription",
        company: "Acme HVAC",
        email: "owner@acmehvac.test",
      },
      { email: "owner@acmehvac.test" },
    );
    const res = await handler(await buildSignedRequest(event));
    await res.text();
    assertEquals(res.status, 200);
    assertHitTable("field_crm_clients");
    assertInvokedFunction("auto-onboard");
    const onboard = callsMatching((c) => c.url.includes("/functions/v1/auto-onboard"))[0];
    assertStringIncludes(onboard.body || "", "field_service_subscription");
  },
});

Deno.test({
  name: "integration — TechAlert (hire_alert_subscription) fulfills",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    installFetchStub();
    const event = buildCheckoutSessionCompletedEvent(
      {
        type: "hire_alert_subscription",
        business_name: "Joe's Plumbing",
        vertical: "trades",
        city: "Detroit",
        state: "MI",
        email: "joe@joesplumbing.test",
      },
      { email: "joe@joesplumbing.test" },
    );
    const res = await handler(await buildSignedRequest(event));
    await res.text();
    assertEquals(res.status, 200);
    assertHitTable("hire_alert_clients");
  },
});

Deno.test({
  name: "integration — Contractor Leads (contractor_lead_subscription) fulfills",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    installFetchStub();
    const event = buildCheckoutSessionCompletedEvent(
      {
        type: "contractor_lead_subscription",
        contractor_id: crypto.randomUUID(),
        trade: "roofing",
        city: "Detroit",
        email: "pro@roofers.test",
      },
      { email: "pro@roofers.test" },
    );
    const res = await handler(await buildSignedRequest(event));
    await res.text();
    assertEquals(res.status, 200);
    const emailHit = callsMatching((c) => c.url.includes("api.resend.com"));
    const tableHit = callsMatching((c) => c.url.includes("/rest/v1/contractor_"));
    assert(
      emailHit.length + tableHit.length > 0,
      `Expected contractor fulfillment side-effect (email or contractor_* write).`,
    );
  },
});

Deno.test({
  name: "integration — Missed-Call Catch (missed_call_subscription) fulfills",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    installFetchStub();
    const event = buildCheckoutSessionCompletedEvent(
      {
        type: "missed_call_subscription",
        businessName: "Sunny Spa",
        email: "owner@sunnyspa.test",
      },
      { email: "owner@sunnyspa.test" },
    );
    const res = await handler(await buildSignedRequest(event));
    await res.text();
    assertEquals(res.status, 200);
    assertHitTable("missed_call_clients");
    assertInvokedFunction("auto-onboard");
    const onboard = callsMatching((c) => c.url.includes("/functions/v1/auto-onboard"))[0];
    assertStringIncludes(onboard.body || "", "missed_call_subscription");
  },
});

Deno.test({
  name: "integration — Mortgage Radar (mortgage_radar_subscription) fulfills",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    installFetchStub();
    const event = buildCheckoutSessionCompletedEvent(
      {
        type: "mortgage_radar_subscription",
        lo_name: "Jane Loanmaker",
        nmls_id: "12345",
        email: "jane@loans.test",
      },
      { email: "jane@loans.test" },
    );
    const res = await handler(await buildSignedRequest(event));
    await res.text();
    assertEquals(res.status, 200);
    assertHitTable("mortgage_radar_clients");
  },
});

// ─── 7. Cleanup ─────────────────────────────────────────────────────────
addEventListener("unload", () => restoreFetch());
