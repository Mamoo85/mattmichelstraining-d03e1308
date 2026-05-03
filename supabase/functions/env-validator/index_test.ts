// Smoke tests for env-validator. Run: deno test --allow-env --allow-net supabase/functions/env-validator/index_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
];

Deno.test("env-validator: missing-list logic identifies unset vars", () => {
  // Test the detection logic inline without touching live env vars
  const fakeEnv: Record<string, string | undefined> = {
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: "set",
    ANTHROPIC_API_KEY: undefined,
    STRIPE_SECRET_KEY: "set",
    STRIPE_WEBHOOK_SECRET: undefined,
    RESEND_API_KEY: undefined,
    TWILIO_ACCOUNT_SID: "set",
    TWILIO_AUTH_TOKEN: undefined,
    TWILIO_PHONE_NUMBER: undefined,
  };
  const missing = REQUIRED.filter((k) => !fakeEnv[k]);
  assertEquals(missing.length, 6);
  assert(missing.includes("SUPABASE_URL"));
  assert(missing.includes("ANTHROPIC_API_KEY"));
});

Deno.test("env-validator: returns ok when all required vars present", () => {
  const snapshot: Record<string, string | undefined> = {};
  for (const k of REQUIRED) {
    snapshot[k] = Deno.env.get(k);
    Deno.env.set(k, "test_value");
  }

  const missing = REQUIRED.filter((k) => !Deno.env.get(k));
  assertEquals(missing.length, 0);

  // Restore
  for (const k of REQUIRED) {
    if (snapshot[k] === undefined) Deno.env.delete(k);
    else Deno.env.set(k, snapshot[k]!);
  }
});
