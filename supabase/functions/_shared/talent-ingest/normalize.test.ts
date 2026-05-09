import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalize, normalizePhone } from "./normalize.ts";

Deno.test("normalizePhone — handles 10-digit US", () => {
  assertEquals(normalizePhone("(313) 555-1234"), "+13135551234");
  assertEquals(normalizePhone("3135551234"), "+13135551234");
  assertEquals(normalizePhone("13135551234"), "+13135551234");
  assertEquals(normalizePhone("555"), null);
  assertEquals(normalizePhone(""), null);
  assertEquals(normalizePhone(null), null);
});

Deno.test("normalize — basic happy path", () => {
  const n = normalize({
    source: "test",
    full_name: "Jane Smith",
    trade: "RN",
    state: "mi",
    phone: "313-555-1234",
    email: "Jane@Example.COM",
    license_number: "rn-123 abc",
  });
  assertEquals(n.name_normalized, "jane smith");
  assertEquals(n.phone_e164, "+13135551234");
  assertEquals(n.email_normalized, "jane@example.com");
  assertEquals(n.domain_normalized, "example.com");
  assertEquals(n.trade_canonical, "nursing");
  assertEquals(n.state_upper, "MI");
  assertEquals(n.license_number_clean, "RN-123ABC");
  assertEquals(n.is_junk, false);
  assert(n.confidence >= 0.9);
});

Deno.test("normalize — strips name suffixes", () => {
  const n = normalize({ source: "t", full_name: "John Doe Jr." });
  assertEquals(n.name_normalized, "john doe");
});

Deno.test("normalize — flags junk names", () => {
  for (const name of ["About Us", "Main Menu", "ab", ""]) {
    const n = normalize({ source: "t", full_name: name });
    assertEquals(n.is_junk, true, `expected junk for "${name}"`);
  }
});

Deno.test("normalize — invalid email lowers confidence and yields null", () => {
  const n = normalize({ source: "t", full_name: "Jane Doe", email: "not-an-email" });
  assertEquals(n.email_normalized, null);
  assert(n.confidence < 1.0);
});

Deno.test("normalize — trade canonical fuzzy match", () => {
  assertEquals(normalize({ source: "t", full_name: "X Y", trade: "Heating and Cooling" }).trade_canonical, "hvac");
  assertEquals(normalize({ source: "t", full_name: "X Y", trade: "Licensed Practical Nurse" }).trade_canonical, "nursing");
  assertEquals(normalize({ source: "t", full_name: "X Y", trade: "CDL Driver" }).trade_canonical, "cdl_trucking");
});
