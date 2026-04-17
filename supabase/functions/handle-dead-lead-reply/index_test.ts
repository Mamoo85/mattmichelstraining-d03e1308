import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== OPT_OUT_KEYWORDS detection =====
// Reimplemented from index.ts.

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end", "remove"];

function isOptOut(replyBody: string): boolean {
  return OPT_OUT_KEYWORDS.includes(replyBody.toLowerCase());
}

Deno.test("opt-out — 'stop' triggers opt-out", () => {
  assertEquals(isOptOut("stop"), true);
  assertEquals(isOptOut("STOP"), true);
  assertEquals(isOptOut("Stop"), true);
});

Deno.test("opt-out — 'unsubscribe' triggers opt-out", () => {
  assertEquals(isOptOut("unsubscribe"), true);
  assertEquals(isOptOut("UNSUBSCRIBE"), true);
});

Deno.test("opt-out — 'cancel' triggers opt-out", () => {
  assertEquals(isOptOut("cancel"), true);
});

Deno.test("opt-out — 'quit' triggers opt-out", () => {
  assertEquals(isOptOut("quit"), true);
});

Deno.test("opt-out — 'end' triggers opt-out", () => {
  assertEquals(isOptOut("end"), true);
});

Deno.test("opt-out — 'remove' triggers opt-out", () => {
  assertEquals(isOptOut("remove"), true);
});

Deno.test("opt-out — positive replies do NOT trigger opt-out", () => {
  assertEquals(isOptOut("yes"), false);
  assertEquals(isOptOut("YES"), false);
  assertEquals(isOptOut("interested"), false);
  assertEquals(isOptOut("still need it"), false);
});

Deno.test("opt-out — partial matches do NOT trigger opt-out (exact word required)", () => {
  // 'stop' must be the entire trimmed body to match OPT_OUT_KEYWORDS.includes()
  assertEquals(isOptOut("please stop texting"), false);
  assertEquals(isOptOut("don't stop"), false);
});

Deno.test("opt-out — empty string does NOT trigger opt-out", () => {
  assertEquals(isOptOut(""), false);
});

// ===== Fallback keyword classifier (no Anthropic key) =====
// Reimplemented from index.ts.

function classifyReplyFallback(replyBody: string): "POSITIVE" | "HARD_NO" | "UNKNOWN" {
  const lower = replyBody.toLowerCase();
  if (
    lower.includes("yes") ||
    lower.includes("still") ||
    lower.includes("need") ||
    lower.includes("interested")
  ) {
    return "POSITIVE";
  }
  if (
    lower.includes("no") ||
    lower.includes("fixed") ||
    lower.includes("already") ||
    lower.includes("someone else")
  ) {
    return "HARD_NO";
  }
  return "UNKNOWN";
}

Deno.test("classifier — 'yes' is POSITIVE", () => {
  assertEquals(classifyReplyFallback("yes"), "POSITIVE");
  assertEquals(classifyReplyFallback("Yes please!"), "POSITIVE");
  assertEquals(classifyReplyFallback("YES"), "POSITIVE");
});

Deno.test("classifier — 'still' phrases are POSITIVE", () => {
  assertEquals(classifyReplyFallback("still having issues"), "POSITIVE");
  assertEquals(classifyReplyFallback("Yes still interested"), "POSITIVE");
});

Deno.test("classifier — 'need' phrases are POSITIVE", () => {
  assertEquals(classifyReplyFallback("I still need a quote"), "POSITIVE");
  assertEquals(classifyReplyFallback("need help asap"), "POSITIVE");
});

Deno.test("classifier — 'interested' is POSITIVE", () => {
  assertEquals(classifyReplyFallback("still interested"), "POSITIVE");
});

Deno.test("classifier — 'no' is HARD_NO", () => {
  assertEquals(classifyReplyFallback("no thanks"), "HARD_NO");
  assertEquals(classifyReplyFallback("No"), "HARD_NO");
});

Deno.test("classifier — 'fixed' is HARD_NO", () => {
  assertEquals(classifyReplyFallback("already fixed"), "HARD_NO");
  assertEquals(classifyReplyFallback("got it fixed"), "HARD_NO");
});

Deno.test("classifier — 'already' is HARD_NO", () => {
  assertEquals(classifyReplyFallback("already handled it"), "HARD_NO");
});

Deno.test("classifier — 'someone else' is HARD_NO", () => {
  assertEquals(classifyReplyFallback("went with someone else"), "HARD_NO");
});

Deno.test("classifier — ambiguous reply returns UNKNOWN", () => {
  assertEquals(classifyReplyFallback("maybe"), "UNKNOWN");
  assertEquals(classifyReplyFallback("ok"), "UNKNOWN");
  assertEquals(classifyReplyFallback("who is this?"), "UNKNOWN");
});

// ===== chargeContractor error handling =====
// Tests the guard logic around Stripe response handling.

interface FakeStripeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

async function evaluateChargeResponse(res: FakeStripeResponse): Promise<"succeeded" | "failed"> {
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe charge failed (${res.status}): ${errText}`);
  }
  const pi = await res.json() as { error?: { message: string }; status: string };
  if (pi.error) {
    throw new Error(`Stripe payment intent error: ${pi.error.message}`);
  }
  if (pi.status !== "succeeded") {
    throw new Error(`Stripe payment not completed: status=${pi.status}`);
  }
  return "succeeded";
}

Deno.test("chargeContractor — 402 non-ok response throws with status code", async () => {
  const res: FakeStripeResponse = {
    ok: false,
    status: 402,
    json: async () => ({}),
    text: async () => "card_declined",
  };
  let threw = false;
  try {
    await evaluateChargeResponse(res);
  } catch (e) {
    threw = true;
    assertStringIncludes((e as Error).message, "402");
    assertStringIncludes((e as Error).message, "card_declined");
  }
  assertEquals(threw, true);
});

Deno.test("chargeContractor — pi.error present throws with Stripe error message", async () => {
  const res: FakeStripeResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      error: { message: "Your card has insufficient funds." },
      status: "requires_payment_method",
    }),
    text: async () => "",
  };
  let threw = false;
  try {
    await evaluateChargeResponse(res);
  } catch (e) {
    threw = true;
    assertStringIncludes((e as Error).message, "insufficient funds");
  }
  assertEquals(threw, true);
});

Deno.test("chargeContractor — non-succeeded status throws (3D Secure case)", async () => {
  const res: FakeStripeResponse = {
    ok: true,
    status: 200,
    json: async () => ({ status: "requires_action", id: "pi_abc" }),
    text: async () => "",
  };
  let threw = false;
  try {
    await evaluateChargeResponse(res);
  } catch (e) {
    threw = true;
    assertStringIncludes((e as Error).message, "requires_action");
  }
  assertEquals(threw, true);
});

Deno.test("chargeContractor — succeeded status resolves without error", async () => {
  const res: FakeStripeResponse = {
    ok: true,
    status: 200,
    json: async () => ({ status: "succeeded", id: "pi_abc123" }),
    text: async () => "",
  };
  const result = await evaluateChargeResponse(res);
  assertEquals(result, "succeeded");
});

// ===== Idempotency key format =====
// The charge uses contactId to prevent double-charging on duplicate SMS replies.

function buildIdempotencyKey(contactId: string): string {
  return `dead-lead-${contactId}`;
}

Deno.test("idempotency key — prefixed with dead-lead- and contact ID", () => {
  assertEquals(buildIdempotencyKey("contact-uuid-123"), "dead-lead-contact-uuid-123");
});

Deno.test("idempotency key — same contact ID always produces same key", () => {
  const id = "abc-def-456";
  assertEquals(buildIdempotencyKey(id), buildIdempotencyKey(id));
});

Deno.test("idempotency key — different contacts produce different keys", () => {
  const key1 = buildIdempotencyKey("contact-001");
  const key2 = buildIdempotencyKey("contact-002");
  assertEquals(key1 === key2, false);
});
