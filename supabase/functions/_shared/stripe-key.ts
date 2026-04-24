// Centralized Stripe key resolver.
// If STRIPE_TEST_SECRET_KEY is set, all checkouts/webhooks run in test mode.
// Remove the secret to revert to live mode — no redeploy required.

export function getStripeSecretKey(): string {
  const test = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  const live = Deno.env.get("STRIPE_SECRET_KEY");
  if (test && test.startsWith("sk_test_")) {
    console.warn("[STRIPE] 🧪 TEST MODE active (STRIPE_TEST_SECRET_KEY)");
    return test;
  }
  if (!live) throw new Error("STRIPE_SECRET_KEY is not set");
  return live;
}

export function getStripeWebhookSecret(): string {
  const test = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");
  const live = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  // Use test webhook secret only if test key is also active — keeps signing aligned.
  const stripeKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (stripeKey && stripeKey.startsWith("sk_test_") && test) {
    console.warn("[STRIPE] 🧪 TEST WEBHOOK secret active");
    return test;
  }
  if (!live) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return live;
}

export function isStripeTestMode(): boolean {
  const t = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  return !!(t && t.startsWith("sk_test_"));
}
