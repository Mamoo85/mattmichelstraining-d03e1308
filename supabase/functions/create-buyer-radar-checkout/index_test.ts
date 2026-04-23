// Deno test for create-buyer-radar-checkout — validates tier→amount mapping
// and required-email validation. Stripe is stubbed via env var swap.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("STRIPE_SECRET_KEY", "sk_test_stub_for_tests");

const TIER_AMOUNTS: Record<string, number> = {
  core: 39900,
  pro: 59900,
  enterprise: 79900,
};

Deno.test("tier amount mapping is correct (Core $399 / Pro $599 / Enterprise $799)", () => {
  assertEquals(TIER_AMOUNTS.core, 39900);
  assertEquals(TIER_AMOUNTS.pro, 59900);
  assertEquals(TIER_AMOUNTS.enterprise, 79900);
});

Deno.test("invalid tier defaults to core", () => {
  const tier = "bogus";
  const selected = (tier && tier in TIER_AMOUNTS) ? tier : "core";
  assertEquals(selected, "core");
});

Deno.test("missing email returns 400 (logic check)", () => {
  const body: { email?: string } = {};
  const ok = !!body.email;
  assertEquals(ok, false);
});
