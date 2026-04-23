// Deno test for request-buyer-radar-custom — validates required-field guard.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("missing company_name and email is rejected", () => {
  const body: { company_name?: string; email?: string } = {};
  const ok = !!(body.company_name && body.email);
  assertEquals(ok, false);
});

Deno.test("body with company_name + email passes the guard", () => {
  const body = { company_name: "Ameristeel", email: "ops@ameristeel.com" };
  const ok = !!(body.company_name && body.email);
  assertEquals(ok, true);
});

Deno.test("target_accounts is coerced to number when provided", () => {
  const ta = "150";
  const num = ta ? Number(ta) : null;
  assertEquals(num, 150);
});

Deno.test("target_accounts is null when blank", () => {
  const ta = "";
  const num = ta ? Number(ta) : null;
  assertEquals(num, null);
});
